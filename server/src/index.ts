#!/usr/bin/env node

import cors from "cors";
import { parseArgs } from "node:util";
import express from "express";
import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { ServerConnectionManager } from "./ServerConnectionManager.js";
import { MultiServerProxy } from "./MultiServerProxy.js";

const DEFAULT_MCP_PROXY_LISTEN_PORT = "6277";

// Parse command line arguments
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    port: { type: "string", default: DEFAULT_MCP_PROXY_LISTEN_PORT },
    config: { type: "string", default: "" },
    "no-auth": { type: "boolean", default: false },
  },
});

const app = express();

// CORS and security headers
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Expose-Headers", "mcp-session-id");
  next();
});

// Initialize the multi-server system
const serverManager = new ServerConnectionManager();
const multiProxy = new MultiServerProxy(serverManager);

// Session management
const sessions: Map<string, { id: string; transport: Transport }> = new Map();

// Authentication setup
const sessionToken = process.env.MCP_PROXY_AUTH_TOKEN || randomBytes(32).toString("hex");
const authDisabled = values["no-auth"] || !!process.env.DANGEROUSLY_OMIT_AUTH;

if (authDisabled) {
  console.warn("⚠️  Authentication disabled - not recommended for production!");
} else {
  console.log("🔐 Authentication enabled. Session token:", sessionToken);
}

// Origin validation middleware
const originValidationMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const origin = req.headers.origin;
  const clientPort = process.env.CLIENT_PORT || "6274";
  const defaultOrigin = `http://localhost:${clientPort}`;
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [defaultOrigin];

  if (origin && !allowedOrigins.includes(origin)) {
    console.error(`Invalid origin: ${origin}`);
    res.status(403).json({
      error: "Forbidden - invalid origin",
      message: "Request blocked to prevent DNS rebinding attacks.",
    });
    return;
  }
  next();
};

// Authentication middleware
const authMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  if (authDisabled) {
    return next();
  }

  const token = req.headers["x-mcp-proxy-auth"];
  if (!token || typeof token !== "string") {
    return res.status(401).json({ error: "Authentication required" });
  }

  const providedToken = Buffer.from(token);
  const expectedToken = Buffer.from(sessionToken);

  if (providedToken.length !== expectedToken.length ||
      !timingSafeEqual(providedToken, expectedToken)) {
    return res.status(401).json({ error: "Invalid authentication token" });
  }

  next();
};

// Apply middlewares
app.use(originValidationMiddleware);
app.use(authMiddleware);

// Dashboard API endpoints
app.get("/api/dashboard/status", (req, res) => {
  const proxyStats = multiProxy.getStats();
  const serverStats = serverManager.getStatusSummary();

  res.json({
    proxy: proxyStats,
    servers: serverStats,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

app.get("/api/dashboard/servers", (req, res) => {
  res.json(serverManager.getStatusSummary());
});

app.post("/api/dashboard/servers/:id/connect", async (req, res) => {
  try {
    await serverManager.connectServer(req.params.id);
    res.json({ success: true, serverId: req.params.id });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error), serverId: req.params.id });
  }
});

app.post("/api/dashboard/servers/:id/disconnect", async (req, res) => {
  try {
    await serverManager.disconnectServer(req.params.id);
    res.json({ success: true, serverId: req.params.id });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error), serverId: req.params.id });
  }
});

app.post("/api/dashboard/servers", async (req, res) => {
  try {
    const serverConfig = {
      id: req.body.id || randomUUID(),
      name: req.body.name,
      command: req.body.command,
      args: req.body.args || [],
      env: req.body.env || {},
      transport: req.body.transport || "stdio",
      serverUrl: req.body.serverUrl,
      enabled: req.body.enabled !== false,
    };

    await serverManager.addServer(serverConfig);
    res.json({ success: true, server: serverConfig });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.delete("/api/dashboard/servers/:id", async (req, res) => {
  try {
    await serverManager.removeServer(req.params.id);
    res.json({ success: true, serverId: req.params.id });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error), serverId: req.params.id });
  }
});

// SSE endpoint for dashboard status streaming
app.use("/sse/dashboard", (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });

  const clientId = randomUUID();
  console.log(`📡 SSE client connected: ${clientId}`);

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: "connection",
    data: { clientId, timestamp: new Date().toISOString() }
  })}\n\n`);

  // Send initial status
  const sendStatus = () => {
    const proxyStats = multiProxy.getStats();
    const serverStats = serverManager.getStatusSummary();

    const statusData = {
      type: "status",
      data: {
        proxy: proxyStats,
        servers: serverStats,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      }
    };

    res.write(`data: ${JSON.stringify(statusData)}\n\n`);
  };

  // Send initial status
  sendStatus();

  // Set up event listeners for real-time updates
  const handleServerEvent = (event: any) => {
    const eventData = {
      type: "server-event",
      data: {
        ...event,
        timestamp: new Date().toISOString(),
      }
    };
    res.write(`data: ${JSON.stringify(eventData)}\n\n`);

    // Send updated status after server events
    setTimeout(sendStatus, 100);
  };

  const handleProxyEvent = (eventType: string, eventData: any) => {
    const event = {
      type: "proxy-event",
      data: {
        event: eventType,
        ...eventData,
        timestamp: new Date().toISOString(),
      }
    };
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Register event listeners
  serverManager.on("server-event", handleServerEvent);
  multiProxy.on("session-created", (data) => handleProxyEvent("session-created", data));
  multiProxy.on("session-removed", (data) => handleProxyEvent("session-removed", data));

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({
      type: "heartbeat",
      data: { timestamp: new Date().toISOString() }
    })}\n\n`);
  }, 30000); // Every 30 seconds

  // Handle client disconnect
  req.on("close", () => {
    console.log(`📡 SSE client disconnected: ${clientId}`);
    clearInterval(heartbeat);

    // Remove event listeners
    serverManager.removeListener("server-event", handleServerEvent);
    multiProxy.removeListener("session-created", (data) => handleProxyEvent("session-created", data));
    multiProxy.removeListener("session-removed", (data) => handleProxyEvent("session-removed", data));
  });

  req.on("error", (err) => {
    console.error(`📡 SSE client error for ${clientId}:`, err);
    clearInterval(heartbeat);
  });
});

// StreamableHTTP endpoint for MCP communication (TODO: Complete in Task 5)
app.use("/streamablehttp/:sessionId", express.raw({ type: "application/octet-stream" }), (req, res) => {
  const sessionId = req.params.sessionId;

  if (!sessionId) {
    res.status(400).json({ error: "Session ID required" });
    return;
  }

  // TODO: Implement proper StreamableHTTP transport when completing Task 5
  res.status(501).json({
    error: "StreamableHTTP endpoint not yet implemented",
    message: "This endpoint will be completed in Task 5 - Real-time updates system"
  });
});

// WebSocket endpoint for real-time updates (future enhancement)
app.get("/ws", (req, res) => {
  res.status(501).json({
    error: "WebSocket support coming soon",
    alternatives: ["/sse/:sessionId", "/streamablehttp/:sessionId"]
  });
});

// Load server configuration
async function loadConfiguration() {
  let configPath = values.config;

  if (!configPath) {
    // Try default locations
    const defaultPaths = [
      "./dashboard-config.json",
      "./mcp-config.json",
      "./sample-config.json",
      path.join(process.cwd(), "dashboard-config.json"),
    ];

    configPath = defaultPaths.find(p => existsSync(p)) || "";
  }

  if (configPath && existsSync(configPath)) {
    try {
      console.log(`📋 Loading configuration from: ${configPath}`);
      const configData = JSON.parse(readFileSync(configPath, "utf8"));
      await serverManager.loadFromConfig(configData);
      console.log(`✅ Loaded ${serverManager.getAllConnections().size} server configurations`);
    } catch (error) {
      console.error("❌ Error loading configuration:", error instanceof Error ? error.message : String(error));
      console.log("📝 Continuing with empty configuration. Add servers via API or web interface.");
    }
  } else {
    console.log("📝 No configuration file found. Starting with empty configuration.");
    console.log("💡 You can add servers via the web interface or API endpoints.");
  }
}

// Event logging for debugging
serverManager.on("server-added", ({ serverId, config }) => {
  console.log(`➕ Server added: ${config.name} (${serverId})`);
});

serverManager.on("server-removed", ({ serverId }) => {
  console.log(`➖ Server removed: ${serverId}`);
});

serverManager.on("server-event", (event) => {
  const { serverId, event: eventType, timestamp } = event;
  console.log(`🔔 [${timestamp.toISOString()}] Server ${serverId}: ${eventType}`);
});

multiProxy.on("session-created", ({ sessionId }) => {
  console.log(`🔗 Proxy session created: ${sessionId}`);
});

multiProxy.on("session-removed", ({ sessionId }) => {
  console.log(`🔗 Proxy session removed: ${sessionId}`);
});

// Periodic cleanup
setInterval(() => {
  multiProxy.cleanupInactiveSessions();
}, 60000); // Every minute

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down MCP Dashboard server...");

  try {
    await multiProxy.cleanup();
    await serverManager.cleanup();
    console.log("✅ Cleanup completed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  }
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  await multiProxy.cleanup();
  await serverManager.cleanup();
  process.exit(0);
});

// Start server
const port = parseInt(values.port || DEFAULT_MCP_PROXY_LISTEN_PORT);

async function startServer() {
  await loadConfiguration();

  const server = app.listen(port, () => {
    console.log(`🚀 MCP Dashboard server running on port ${port}`);
    console.log(`📊 Dashboard API available at: http://localhost:${port}/api/dashboard/status`);
    console.log(`🔌 MCP SSE endpoint: http://localhost:${port}/sse/:sessionId`);
    console.log(`🔌 MCP StreamableHTTP endpoint: http://localhost:${port}/streamablehttp/:sessionId`);

    if (!authDisabled) {
      console.log(`🔑 Auth token: ${sessionToken}`);
    }
  });

  server.on("error", (error) => {
    console.error("❌ Server error:", error);
  });

  return server;
}

// Start the server
startServer().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});

export { serverManager, multiProxy };