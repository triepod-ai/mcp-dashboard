#!/usr/bin/env node

import cors from "cors";
import { parseArgs } from "node:util";
import express from "express";
import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "node:http";

import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { ServerConnectionManager } from "./ServerConnectionManager.js";
import { MultiServerProxy } from "./MultiServerProxy.js";

// Helper function to send MCP request and wait for response
async function sendMCPRequestWithResponse(
  serverId: string,
  request: any,
  serverManager: ServerConnectionManager,
  timeoutMs: number = 30000,
): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const connection = serverManager.getConnection(serverId);
    if (!connection) {
      return reject(new Error(`Server '${serverId}' not found`));
    }

    if (connection.status !== "connected") {
      return reject(new Error(`Server '${serverId}' is not connected`));
    }

    const requestId = request.id;
    let responseReceived = false;

    // Set up timeout
    const timeout = setTimeout(() => {
      if (!responseReceived) {
        responseReceived = true;
        // Restore original onmessage handler
        connection.transport.onmessage = originalOnMessage;
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    // Store original onmessage handler
    const originalOnMessage = connection.transport.onmessage;

    // Set up response listener
    const responseListener = (message: any) => {
      try {
        // Look for JSON-RPC response with matching ID
        if (message && message.id === requestId && !responseReceived) {
          responseReceived = true;
          clearTimeout(timeout);
          // Restore original onmessage handler
          connection.transport.onmessage = originalOnMessage;
          resolve(message);
        }
      } catch (error) {
        if (!responseReceived) {
          responseReceived = true;
          clearTimeout(timeout);
          // Restore original onmessage handler
          connection.transport.onmessage = originalOnMessage;
          reject(error);
        }
      }
    };

    // Set our temporary message handler
    connection.transport.onmessage = responseListener;

    try {
      // Send the request
      await connection.transport.send(request);
    } catch (error) {
      if (!responseReceived) {
        responseReceived = true;
        clearTimeout(timeout);
        // Restore original onmessage handler
        connection.transport.onmessage = originalOnMessage;
        reject(error);
      }
    }
  });
}

// WebSocket message types for streaming tool execution
interface WebSocketMessage {
  type:
    | "tool-execute"
    | "tool-progress"
    | "tool-result"
    | "tool-error"
    | "tool-cancel";
  executionId: string;
  data: any;
}

interface ToolExecutionRequest {
  serverId: string;
  toolName: string;
  parameters: Record<string, any>;
}

// Active tool executions for cancellation support
const activeExecutions = new Map<
  string,
  { controller: AbortController; ws: WebSocket }
>();

// Enhanced streaming tool execution with progress feedback
async function sendMCPRequestWithStreaming(
  serverId: string,
  request: any,
  serverManager: ServerConnectionManager,
  onProgress?: (progress: any) => void,
  abortSignal?: AbortSignal,
): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const connection = serverManager.getConnection(serverId);
    if (!connection) {
      return reject(new Error(`Server '${serverId}' not found`));
    }

    if (connection.status !== "connected") {
      return reject(new Error(`Server '${serverId}' is not connected`));
    }

    const requestId = request.id;
    let responseReceived = false;

    // Check for cancellation
    if (abortSignal?.aborted) {
      return reject(new Error("Operation was cancelled"));
    }

    // Set up abort signal listener
    const abortListener = () => {
      if (!responseReceived) {
        responseReceived = true;
        connection.transport.onmessage = originalOnMessage;
        reject(new Error("Operation was cancelled"));
      }
    };
    abortSignal?.addEventListener("abort", abortListener);

    // Set up timeout
    const timeout = setTimeout(() => {
      if (!responseReceived) {
        responseReceived = true;
        connection.transport.onmessage = originalOnMessage;
        abortSignal?.removeEventListener("abort", abortListener);
        reject(new Error(`Request timeout after 30000ms`));
      }
    }, 30000);

    // Store original onmessage handler
    const originalOnMessage = connection.transport.onmessage;

    // Set up response listener with progress support
    const responseListener = (message: any) => {
      try {
        if (message.id === requestId) {
          clearTimeout(timeout);
          responseReceived = true;
          abortSignal?.removeEventListener("abort", abortListener);
          connection.transport.onmessage = originalOnMessage;
          resolve(message);
        } else if (
          message.method === "notifications/progress" &&
          message.params?.token === requestId
        ) {
          // Handle progress notifications
          onProgress?.(message.params);
        }
      } catch (error) {
        if (!responseReceived) {
          responseReceived = true;
          clearTimeout(timeout);
          abortSignal?.removeEventListener("abort", abortListener);
          connection.transport.onmessage = originalOnMessage;
          reject(error);
        }
      }
    };

    // Set our temporary message handler
    connection.transport.onmessage = responseListener;

    try {
      // Send the request
      await connection.transport.send(request);
    } catch (error) {
      if (!responseReceived) {
        responseReceived = true;
        clearTimeout(timeout);
        abortSignal?.removeEventListener("abort", abortListener);
        connection.transport.onmessage = originalOnMessage;
        reject(error);
      }
    }
  });
}

const DEFAULT_MCP_PROXY_LISTEN_PORT = "6287";

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
const sessionToken =
  process.env.MCP_PROXY_AUTH_TOKEN || randomBytes(32).toString("hex");
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
  const clientPort = process.env.CLIENT_PORT || "6286";
  const defaultOrigin = `http://localhost:${clientPort}`;
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
    defaultOrigin,
  ];

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

  if (
    providedToken.length !== expectedToken.length ||
    !timingSafeEqual(providedToken, expectedToken)
  ) {
    return res.status(401).json({ error: "Invalid authentication token" });
  }

  next();
};

// SSE endpoint for dashboard status streaming (before auth middleware)
app.use("/sse/dashboard", (req, res) => {
  // Check authentication via query parameter for SSE (since EventSource can't send headers)
  if (!authDisabled) {
    const token = req.query.token;
    if (!token || typeof token !== "string") {
      return res.status(401).json({
        error: "Authentication required. Add ?token=YOUR_TOKEN to the URL",
      });
    }

    const providedToken = Buffer.from(token);
    const expectedToken = Buffer.from(sessionToken);

    if (
      providedToken.length !== expectedToken.length ||
      !timingSafeEqual(providedToken, expectedToken)
    ) {
      return res.status(401).json({ error: "Invalid authentication token" });
    }
  }

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });

  const clientId = randomUUID();
  console.log(`📡 SSE client connected: ${clientId}`);

  // Send initial connection event
  res.write(
    `data: ${JSON.stringify({
      type: "connection",
      data: { clientId, timestamp: new Date().toISOString() },
    })}\n\n`,
  );

  // Send initial status
  const sendStatus = () => {
    const proxyStats = multiProxy.getStats();
    const serverStats = serverManager.getStatusSummary();

    const statusData = {
      type: "status",
      data: {
        timestamp: new Date().toISOString(),
        servers: serverStats.servers,
        connections: {
          total: proxyStats.totalSessions,
          active: proxyStats.activeSessions,
        },
        messageQueue: proxyStats.messageQueue,
        connectedServers: proxyStats.connectedServers,
        totalServers: proxyStats.totalServers,
        uptime: process.uptime(),
      },
    };

    res.write(`data: ${JSON.stringify(statusData)}\n\n`);
  };

  // Send initial status immediately
  sendStatus();

  // Send status updates every 5 seconds
  const statusInterval = setInterval(sendStatus, 5000);

  // Send heartbeat every 30 seconds
  const heartbeatInterval = setInterval(() => {
    res.write(
      `data: ${JSON.stringify({
        type: "heartbeat",
        data: { timestamp: new Date().toISOString() },
      })}\n\n`,
    );
  }, 30000);

  // Event listeners for real-time updates
  const onServerEvent = (event: any) => {
    res.write(
      `data: ${JSON.stringify({
        type: "server-event",
        data: event,
      })}\n\n`,
    );
  };

  const onProxyEvent = (event: any) => {
    res.write(
      `data: ${JSON.stringify({
        type: "proxy-event",
        data: event,
      })}\n\n`,
    );
  };

  // Subscribe to events
  serverManager.on("statusChange", onServerEvent);
  multiProxy.on("connectionChange", onProxyEvent);

  // Cleanup on client disconnect
  req.on("close", () => {
    console.log(`📡 SSE client disconnected: ${clientId}`);
    clearInterval(statusInterval);
    clearInterval(heartbeatInterval);
    serverManager.off("statusChange", onServerEvent);
    multiProxy.off("connectionChange", onProxyEvent);
  });
});

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
    res.status(400).json({
      error: error instanceof Error ? error.message : String(error),
      serverId: req.params.id,
    });
  }
});

app.post("/api/dashboard/servers/:id/disconnect", async (req, res) => {
  try {
    await serverManager.disconnectServer(req.params.id);
    res.json({ success: true, serverId: req.params.id });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : String(error),
      serverId: req.params.id,
    });
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
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.delete("/api/dashboard/servers/:id", async (req, res) => {
  try {
    await serverManager.removeServer(req.params.id);
    res.json({ success: true, serverId: req.params.id });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : String(error),
      serverId: req.params.id,
    });
  }
});

// MCP tool discovery and execution endpoints
app.get("/api/dashboard/servers/:id/tools", async (req, res) => {
  try {
    const serverId = req.params.id;
    const connection = serverManager.getConnection(serverId);

    console.log(
      `🔧 Tools request for ${serverId}:`,
      connection
        ? `status="${connection.status}" (type: ${typeof connection.status})`
        : "not found",
    );

    if (!connection) {
      return res.status(404).json({ error: "Server not found", serverId });
    }

    console.log(
      `🔍 Connection status check: "${connection.status}" !== "connected" is ${connection.status !== "connected"}`,
    );

    if (connection.status !== "connected") {
      console.log(
        `❌ Connection not ready. Status: "${connection.status}", returning error`,
      );
      return res
        .status(400)
        .json({ error: "Not connected", serverId, status: connection.status });
    }

    console.log(
      `✅ Status check passed, proceeding with MCP tools/list call for ${serverId}`,
    );

    // Make real MCP tools/list call
    const toolsListRequest = {
      jsonrpc: "2.0",
      id: `tools-list-${Date.now()}`,
      method: "tools/list",
      params: {},
    };

    // Use sendMCPRequestWithResponse to call tools/list (working approach)
    console.log(
      `📡 Calling tools/list via sendMCPRequestWithResponse for ${serverId}`,
    );
    const response = await sendMCPRequestWithResponse(
      serverId,
      toolsListRequest,
      serverManager,
    );
    console.log(`📡 MCP response received:`, response);

    // sendMCPRequestWithResponse returns the raw JSON-RPC response
    if (response.result && response.result.tools) {
      res.json({ tools: response.result.tools, serverId });
    } else {
      res.json({ tools: [], serverId });
    }
  } catch (error) {
    console.log(`💥 Tools endpoint error for ${req.params.id}:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      serverId: req.params.id,
    });
  }
});

// Tool execution endpoint - supports both /call and /execute for compatibility
const toolExecutionHandler = async (
  req: express.Request,
  res: express.Response,
) => {
  try {
    const serverId = req.params.id;
    const toolName = req.params.toolName;
    const parameters = req.body.parameters || {};

    const connection = serverManager.getConnection(serverId);

    if (!connection) {
      return res.status(404).json({ error: "Server not found", serverId });
    }

    if (connection.status !== "connected") {
      return res.status(400).json({
        error: "Server not connected",
        serverId,
        status: connection.status,
      });
    }

    const startTime = Date.now();
    console.log(
      `🛠️ Tool execution request for ${serverId}.${toolName} with parameters:`,
      parameters,
    );

    // Make real MCP tools/call request using the working pattern
    const toolCallRequest = {
      jsonrpc: "2.0",
      id: `tool-call-${Date.now()}`,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: parameters,
      },
    };

    console.log(
      `🛠️ Calling tools/call via sendMCPRequestWithResponse for ${serverId}`,
    );
    const response = await sendMCPRequestWithResponse(
      serverId,
      toolCallRequest,
      serverManager,
    );
    const executionTime = Date.now() - startTime;

    console.log(`🛠️ Tool execution response:`, response);

    res.json({
      success: true,
      toolName,
      serverId,
      parameters,
      result: response.result,
      executionTime,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      serverId: req.params.id,
      toolName: req.params.toolName,
      executionTime: 0,
    });
  }
};

// Register both endpoints for compatibility
app.post(
  "/api/dashboard/servers/:id/tools/:toolName/execute",
  toolExecutionHandler,
);
app.post(
  "/api/dashboard/servers/:id/tools/:toolName/call",
  toolExecutionHandler,
);

// MCP resource exploration endpoints
app.get("/api/dashboard/servers/:id/resources", async (req, res) => {
  try {
    const serverId = req.params.id;
    const connection = serverManager.getConnection(serverId);

    console.log(
      `📚 Resources request for ${serverId}:`,
      connection ? `status="${connection.status}"` : "not found",
    );

    if (!connection) {
      return res.status(404).json({ error: "Server not found", serverId });
    }

    if (connection.status !== "connected") {
      console.log(
        `❌ Connection not ready for resources. Status: "${connection.status}"`,
      );
      return res
        .status(400)
        .json({ error: "Not connected", serverId, status: connection.status });
    }

    console.log(
      `✅ Status check passed, proceeding with MCP resources/list call for ${serverId}`,
    );

    // Make real MCP resources/list call
    const resourcesListRequest = {
      jsonrpc: "2.0",
      id: `resources-list-${Date.now()}`,
      method: "resources/list",
      params: {},
    };

    console.log(
      `📚 Calling resources/list via sendMCPRequestWithResponse for ${serverId}`,
    );
    const response = await sendMCPRequestWithResponse(
      serverId,
      resourcesListRequest,
      serverManager,
    );
    console.log(`📚 MCP resources response received:`, response);

    // sendMCPRequestWithResponse returns the raw JSON-RPC response
    if (response.result && response.result.resources) {
      res.json({
        resources: response.result.resources,
        nextCursor: response.result.nextCursor,
        serverId,
      });
    } else {
      res.json({ resources: [], nextCursor: null, serverId });
    }
  } catch (error) {
    console.log(`💥 Resources endpoint error for ${req.params.id}:`, error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      serverId: req.params.id,
    });
  }
});

app.get("/api/dashboard/servers/:id/resources/templates", async (req, res) => {
  try {
    const serverId = req.params.id;
    const connection = serverManager.getConnection(serverId);

    console.log(
      `📋 Resource templates request for ${serverId}:`,
      connection ? `status="${connection.status}"` : "not found",
    );

    if (!connection) {
      return res.status(404).json({ error: "Server not found", serverId });
    }

    if (connection.status !== "connected") {
      console.log(
        `❌ Connection not ready for resource templates. Status: "${connection.status}"`,
      );
      return res
        .status(400)
        .json({ error: "Not connected", serverId, status: connection.status });
    }

    console.log(
      `✅ Status check passed, proceeding with MCP resources/templates/list call for ${serverId}`,
    );

    // Make real MCP resources/templates/list call
    const resourceTemplatesListRequest = {
      jsonrpc: "2.0",
      id: `resource-templates-list-${Date.now()}`,
      method: "resources/templates/list",
      params: {},
    };

    console.log(
      `📋 Calling resources/templates/list via sendMCPRequestWithResponse for ${serverId}`,
    );
    const response = await sendMCPRequestWithResponse(
      serverId,
      resourceTemplatesListRequest,
      serverManager,
    );
    console.log(`📋 MCP resource templates response received:`, response);

    // sendMCPRequestWithResponse returns the raw JSON-RPC response
    if (response.result && response.result.resourceTemplates) {
      res.json({
        resourceTemplates: response.result.resourceTemplates,
        nextCursor: response.result.nextCursor,
        serverId,
      });
    } else {
      res.json({ resourceTemplates: [], nextCursor: null, serverId });
    }
  } catch (error) {
    console.log(
      `💥 Resource templates endpoint error for ${req.params.id}:`,
      error,
    );
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      serverId: req.params.id,
    });
  }
});

app.post("/api/dashboard/servers/:id/resources/read", async (req, res) => {
  try {
    const serverId = req.params.id;
    const { uri } = req.body;

    if (!uri) {
      return res.status(400).json({ error: "URI is required", serverId });
    }

    const connection = serverManager.getConnection(serverId);

    console.log(
      `📖 Resource read request for ${serverId}, URI: ${uri}:`,
      connection ? `status="${connection.status}"` : "not found",
    );

    if (!connection) {
      return res.status(404).json({ error: "Server not found", serverId });
    }

    if (connection.status !== "connected") {
      console.log(
        `❌ Connection not ready for resource read. Status: "${connection.status}"`,
      );
      return res
        .status(400)
        .json({ error: "Not connected", serverId, status: connection.status });
    }

    console.log(
      `✅ Status check passed, proceeding with MCP resources/read call for ${serverId}`,
    );

    const startTime = Date.now();

    // Make real MCP resources/read call
    const resourceReadRequest = {
      jsonrpc: "2.0",
      id: `resource-read-${Date.now()}`,
      method: "resources/read",
      params: { uri },
    };

    console.log(
      `📖 Calling resources/read via sendMCPRequestWithResponse for ${serverId}`,
    );
    const response = await sendMCPRequestWithResponse(
      serverId,
      resourceReadRequest,
      serverManager,
    );
    console.log(`📖 MCP resource read response received:`, response);

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    // sendMCPRequestWithResponse returns the raw JSON-RPC response
    if (response.result && response.result.contents) {
      res.json({
        contents: response.result.contents,
        uri,
        serverId,
        executionTime,
      });
    } else {
      res.status(404).json({
        error: "Resource not found or empty response",
        uri,
        serverId,
        executionTime,
      });
    }
  } catch (error) {
    console.log(`💥 Resource read endpoint error for ${req.params.id}:`, error);
    const executionTime = Date.now();
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      uri: req.body.uri,
      serverId: req.params.id,
      executionTime,
    });
  }
});

// SSE endpoint for dashboard status streaming (with auth check)
app.use("/sse/dashboard", (req, res) => {
  // Check authentication via query parameter for SSE (since EventSource can't send headers)
  if (!authDisabled) {
    const token = req.query.token;
    if (!token || typeof token !== "string") {
      return res.status(401).json({
        error: "Authentication required. Add ?token=YOUR_TOKEN to the URL",
      });
    }

    const providedToken = Buffer.from(token);
    const expectedToken = Buffer.from(sessionToken);

    if (
      providedToken.length !== expectedToken.length ||
      !timingSafeEqual(providedToken, expectedToken)
    ) {
      return res.status(401).json({ error: "Invalid authentication token" });
    }
  }

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });

  const clientId = randomUUID();
  console.log(`📡 SSE client connected: ${clientId}`);

  // Send initial connection event
  res.write(
    `data: ${JSON.stringify({
      type: "connection",
      data: { clientId, timestamp: new Date().toISOString() },
    })}\n\n`,
  );

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
      },
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
      },
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
      },
    };
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Register event listeners
  serverManager.on("server-event", handleServerEvent);
  multiProxy.on("session-created", (data) =>
    handleProxyEvent("session-created", data),
  );
  multiProxy.on("session-removed", (data) =>
    handleProxyEvent("session-removed", data),
  );

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(
      `data: ${JSON.stringify({
        type: "heartbeat",
        data: { timestamp: new Date().toISOString() },
      })}\n\n`,
    );
  }, 30000); // Every 30 seconds

  // Handle client disconnect
  req.on("close", () => {
    console.log(`📡 SSE client disconnected: ${clientId}`);
    clearInterval(heartbeat);

    // Remove event listeners
    serverManager.removeListener("server-event", handleServerEvent);
    multiProxy.removeListener("session-created", (data) =>
      handleProxyEvent("session-created", data),
    );
    multiProxy.removeListener("session-removed", (data) =>
      handleProxyEvent("session-removed", data),
    );
  });

  req.on("error", (err) => {
    console.error(`📡 SSE client error for ${clientId}:`, err);
    clearInterval(heartbeat);
  });
});

// StreamableHTTP endpoint for MCP communication (TODO: Complete in Task 5)
app.use(
  "/streamablehttp/:sessionId",
  express.raw({ type: "application/octet-stream" }),
  (req, res) => {
    const sessionId = req.params.sessionId;

    if (!sessionId) {
      res.status(400).json({ error: "Session ID required" });
      return;
    }

    // TODO: Implement proper StreamableHTTP transport when completing Task 5
    res.status(501).json({
      error: "StreamableHTTP endpoint not yet implemented",
      message:
        "This endpoint will be completed in Task 5 - Real-time updates system",
    });
  },
);

// WebSocket endpoint info
app.get("/ws", (req, res) => {
  res.json({
    info: "WebSocket endpoint available at ws://localhost:6287/ws/tools",
    message:
      "Use WebSocket for streaming tool execution with progress feedback",
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

    configPath = defaultPaths.find((p) => existsSync(p)) || "";
  }

  if (configPath && existsSync(configPath)) {
    try {
      console.log(`📋 Loading configuration from: ${configPath}`);
      const configData = JSON.parse(readFileSync(configPath, "utf8"));
      await serverManager.loadFromConfig(configData, configPath);
      console.log(
        `✅ Loaded ${serverManager.getAllConnections().size} server configurations`,
      );
    } catch (error) {
      console.error(
        "❌ Error loading configuration:",
        error instanceof Error ? error.message : String(error),
      );
      console.log(
        "📝 Continuing with empty configuration. Add servers via API or web interface.",
      );
    }
  } else {
    console.log(
      "📝 No configuration file found. Starting with empty configuration.",
    );
    console.log(
      "💡 You can add servers via the web interface or API endpoints.",
    );
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
  console.log(
    `🔔 [${timestamp.toISOString()}] Server ${serverId}: ${eventType}`,
  );
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

// WebSocket handler functions
async function handleToolExecution(ws: WebSocket, message: WebSocketMessage) {
  const { serverId, toolName, parameters }: ToolExecutionRequest = message.data;
  const executionId = message.executionId;

  try {
    // Send initial progress
    ws.send(
      JSON.stringify({
        type: "tool-progress",
        executionId,
        data: { status: "starting", progress: 0 },
      }),
    );

    const startTime = Date.now();
    console.log(`🚀 WebSocket tool execution: ${serverId}.${toolName}`);

    // Create abort controller for cancellation support
    const controller = new AbortController();
    activeExecutions.set(executionId, { controller, ws });

    // Build MCP request
    const toolCallRequest = {
      jsonrpc: "2.0",
      id: `tool-call-${Date.now()}`,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: parameters,
      },
    };

    // Execute with streaming support
    const response = await sendMCPRequestWithStreaming(
      serverId,
      toolCallRequest,
      serverManager,
      (progress) => {
        // Send progress updates
        ws.send(
          JSON.stringify({
            type: "tool-progress",
            executionId,
            data: { status: "running", progress: progress.value || 50 },
          }),
        );
      },
      controller.signal,
    );

    const executionTime = Date.now() - startTime;

    // Send final result
    ws.send(
      JSON.stringify({
        type: "tool-result",
        executionId,
        data: {
          success: true,
          result: response.result,
          executionTime,
          serverId,
          toolName,
          parameters,
        },
      }),
    );

    // Clean up
    activeExecutions.delete(executionId);
  } catch (error) {
    console.error(`🚨 WebSocket tool execution error:`, error);

    ws.send(
      JSON.stringify({
        type: "tool-error",
        executionId,
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          serverId,
          toolName,
        },
      }),
    );

    // Clean up
    activeExecutions.delete(executionId);
  }
}

async function handleToolCancellation(executionId: string) {
  const execution = activeExecutions.get(executionId);
  if (execution) {
    console.log(`🛑 Cancelling tool execution: ${executionId}`);
    execution.controller.abort();
    activeExecutions.delete(executionId);

    execution.ws.send(
      JSON.stringify({
        type: "tool-error",
        executionId,
        data: { error: "Execution cancelled by user" },
      }),
    );
  }
}

// Start server
const port = parseInt(values.port || DEFAULT_MCP_PROXY_LISTEN_PORT);

async function startServer() {
  await loadConfiguration();

  // Create HTTP server to support both Express and WebSocket
  const httpServer = createServer(app);

  // Set up WebSocket server for streaming tool execution
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws/tools",
  });

  wss.on("connection", (ws: WebSocket) => {
    console.log("🔌 WebSocket client connected for tool streaming");

    ws.on("message", async (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        console.log(`📨 WebSocket message received:`, message);

        switch (message.type) {
          case "tool-execute":
            await handleToolExecution(ws, message);
            break;
          case "tool-cancel":
            await handleToolCancellation(message.executionId);
            break;
          default:
            ws.send(
              JSON.stringify({
                type: "tool-error",
                executionId: message.executionId,
                data: { error: `Unknown message type: ${message.type}` },
              }),
            );
        }
      } catch (error) {
        console.error("🚨 WebSocket message error:", error);
        ws.send(
          JSON.stringify({
            type: "tool-error",
            executionId: "unknown",
            data: { error: "Invalid message format" },
          }),
        );
      }
    });

    ws.on("close", () => {
      console.log("🔌 WebSocket client disconnected");
      // Clean up any active executions for this client
      for (const [executionId, execution] of activeExecutions) {
        if (execution.ws === ws) {
          execution.controller.abort();
          activeExecutions.delete(executionId);
        }
      }
    });

    ws.on("error", (error) => {
      console.error("🚨 WebSocket error:", error);
    });
  });

  const server = httpServer.listen(port, () => {
    console.log(`🚀 MCP Dashboard server running on port ${port}`);
    console.log(
      `📊 Dashboard API available at: http://localhost:${port}/api/dashboard/status`,
    );
    console.log(`🔌 MCP SSE endpoint: http://localhost:${port}/sse/:sessionId`);
    console.log(
      `🔌 MCP StreamableHTTP endpoint: http://localhost:${port}/streamablehttp/:sessionId`,
    );
    console.log(`🎯 WebSocket endpoint: ws://localhost:${port}/ws/tools`);

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
