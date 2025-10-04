import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  SSEClientTransport,
  SseError,
} from "@modelcontextprotocol/sdk/client/sse.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { findActualExecutable } from "spawn-rx";
import { EventEmitter } from "events";
import { writeFileSync, existsSync } from "fs";
import path from "path";

export interface ServerConfig {
  id: string;
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  transport?: "stdio" | "sse" | "streamable-http";
  serverUrl?: string;
  enabled: boolean;
}

export interface ServerConnection {
  config: ServerConfig;
  transport: Transport;
  client: Client;
  status: "connecting" | "connected" | "disconnected" | "error";
  lastConnected?: Date;
  lastError?: Error;
  metadata?: {
    capabilities?: any;
    version?: string;
    uptime?: number;
  };
}

export interface ServerEvent {
  serverId: string;
  event: "connected" | "disconnected" | "connecting" | "error" | "message";
  data?: any;
  timestamp: Date;
}

export class ServerConnectionManager extends EventEmitter {
  private connections: Map<string, ServerConnection> = new Map();
  private defaultEnvironment: Record<string, string>;
  private configFilePath: string = "./dashboard-config.json";

  constructor() {
    super();
    this.defaultEnvironment = {
      ...getDefaultEnvironment(),
      ...(process.env.MCP_ENV_VARS ? JSON.parse(process.env.MCP_ENV_VARS) : {}),
    };
  }

  /**
   * Add a new server configuration and optionally connect to it
   */
  async addServer(config: ServerConfig, autoConnect = true): Promise<void> {
    if (this.connections.has(config.id)) {
      throw new Error(`Server with id '${config.id}' already exists`);
    }

    const connection: ServerConnection = {
      config,
      transport: null as any, // Will be set when connecting
      client: null as any, // Will be set when connecting
      status: "disconnected",
    };

    this.connections.set(config.id, connection);
    this.emit("server-added", { serverId: config.id, config });

    // Persist configuration changes
    await this.saveConfiguration();

    if (autoConnect && config.enabled) {
      await this.connectServer(config.id);
    }
  }

  /**
   * Connect to a specific server
   */
  async connectServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Server '${serverId}' not found`);
    }

    if (
      connection.status === "connected" ||
      connection.status === "connecting"
    ) {
      return; // Already connected or connecting
    }

    connection.status = "connecting";
    this.emitServerEvent(serverId, "connecting");

    try {
      const transport = await this.createTransport(connection.config);
      connection.transport = transport;

      // Create MCP client
      const client = new Client(
        {
          name: "mcp-dashboard",
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );

      // Connect the client to the transport and perform handshake
      await client.connect(transport);
      connection.client = client;

      // Set up transport event handlers
      this.setupTransportHandlers(serverId, transport);

      connection.status = "connected";
      connection.lastConnected = new Date();
      connection.lastError = undefined;

      this.emitServerEvent(serverId, "connected");
    } catch (error) {
      connection.status = "error";
      connection.lastError = error as Error;
      this.emitServerEvent(serverId, "error", error);
      throw error;
    }
  }

  /**
   * Disconnect from a specific server
   */
  async disconnectServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Server '${serverId}' not found`);
    }

    if (connection.transport) {
      try {
        await connection.transport.close();
      } catch (error) {
        console.warn(
          `Error closing transport for server '${serverId}':`,
          error,
        );
      }
    }

    connection.status = "disconnected";
    this.emitServerEvent(serverId, "disconnected");
  }

  /**
   * Remove a server configuration and disconnect if connected
   */
  async removeServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Server '${serverId}' not found`);
    }

    if (connection.status === "connected") {
      await this.disconnectServer(serverId);
    }

    this.connections.delete(serverId);
    this.emit("server-removed", { serverId });

    // Persist configuration changes
    await this.saveConfiguration();
  }

  /**
   * Get all server connections
   */
  getAllConnections(): Map<string, ServerConnection> {
    return new Map(this.connections);
  }

  /**
   * Get a specific server connection
   */
  getConnection(serverId: string): ServerConnection | undefined {
    return this.connections.get(serverId);
  }

  /**
   * Send a message to a specific server
   */
  async sendToServer(serverId: string, message: any): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Server '${serverId}' not found`);
    }

    if (connection.status !== "connected") {
      throw new Error(`Server '${serverId}' is not connected`);
    }

    await connection.transport.send(message);
  }

  /**
   * Send a message to all connected servers
   */
  async broadcastToServers(message: any): Promise<void> {
    const promises = Array.from(this.connections.values())
      .filter((conn) => conn.status === "connected")
      .map((conn) => conn.transport.send(message));

    await Promise.allSettled(promises);
  }

  /**
   * Get server status summary
   */
  getStatusSummary() {
    const total = this.connections.size;
    const connected = Array.from(this.connections.values()).filter(
      (conn) => conn.status === "connected",
    ).length;
    const errors = Array.from(this.connections.values()).filter(
      (conn) => conn.status === "error",
    ).length;

    return {
      total,
      connected,
      disconnected: total - connected - errors,
      errors,
      servers: Array.from(this.connections.entries()).map(([id, conn]) => ({
        id,
        name: conn.config.name,
        status: conn.status,
        lastConnected: conn.lastConnected,
        lastError: conn.lastError?.message,
      })),
    };
  }

  /**
   * Load servers from configuration
   */
  async loadFromConfig(
    config: { mcpServers: Record<string, any> },
    configPath?: string,
  ): Promise<void> {
    // Update config path if provided
    if (configPath) {
      this.configFilePath = configPath;
    }

    const promises = Object.entries(config.mcpServers).map(
      ([id, serverConfig]) => {
        const fullConfig: ServerConfig = {
          id,
          name: serverConfig.name || id,
          command: serverConfig.command,
          args: serverConfig.args || [],
          env: serverConfig.env || {},
          transport: serverConfig.transport || "stdio",
          serverUrl: serverConfig.serverUrl,
          enabled: serverConfig.enabled !== false, // Default to true
        };

        // Add server without triggering saveConfiguration during initial load
        return this.addServerWithoutSave(fullConfig, false);
      },
    );

    await Promise.all(promises);

    // Connect to enabled servers
    const enabledServers = Array.from(this.connections.values())
      .filter((conn) => conn.config.enabled)
      .map((conn) => this.connectServer(conn.config.id));

    await Promise.allSettled(enabledServers);
  }

  /**
   * Add a server without triggering saveConfiguration (for initial config loading)
   */
  private async addServerWithoutSave(
    config: ServerConfig,
    autoConnect = true,
  ): Promise<void> {
    if (this.connections.has(config.id)) {
      throw new Error(`Server with id '${config.id}' already exists`);
    }

    const connection: ServerConnection = {
      config,
      transport: null as any, // Will be set when connecting
      client: null as any, // Will be set when connecting
      status: "disconnected",
    };

    this.connections.set(config.id, connection);
    this.emit("server-added", { serverId: config.id, config });

    if (autoConnect && config.enabled) {
      await this.connectServer(config.id);
    }
  }

  /**
   * Create appropriate transport for server configuration
   */
  private async createTransport(config: ServerConfig): Promise<Transport> {
    const environment = {
      ...this.defaultEnvironment,
      ...config.env,
    };

    switch (config.transport) {
      case "sse":
        if (!config.serverUrl) {
          throw new Error("serverUrl is required for SSE transport");
        }
        return new SSEClientTransport(new URL(config.serverUrl));

      case "streamable-http":
        if (!config.serverUrl) {
          throw new Error(
            "serverUrl is required for streamable-http transport",
          );
        }
        return new StreamableHTTPClientTransport(new URL(config.serverUrl));

      case "stdio":
      default:
        if (!config.command) {
          throw new Error("command is required for stdio transport");
        }

        const { cmd, args } = await findActualExecutable(
          config.command,
          config.args || [],
        );
        if (!cmd) {
          throw new Error(`Command not found: ${config.command}`);
        }

        return new StdioClientTransport({
          command: cmd,
          args: args,
          env: environment,
        });
    }
  }

  /**
   * Set up event handlers for a transport
   */
  private setupTransportHandlers(serverId: string, transport: Transport): void {
    transport.onmessage = (message) => {
      this.emitServerEvent(serverId, "message", message);
    };

    transport.onerror = (error) => {
      const connection = this.connections.get(serverId);
      if (connection) {
        connection.status = "error";
        connection.lastError = error;
      }
      this.emitServerEvent(serverId, "error", error);
    };

    transport.onclose = () => {
      const connection = this.connections.get(serverId);
      if (connection && connection.status === "connected") {
        connection.status = "disconnected";
        this.emitServerEvent(serverId, "disconnected");
      }
    };
  }

  /**
   * Emit a server-specific event
   */
  private emitServerEvent(
    serverId: string,
    event: ServerEvent["event"],
    data?: any,
  ): void {
    const serverEvent: ServerEvent = {
      serverId,
      event,
      data,
      timestamp: new Date(),
    };

    this.emit("server-event", serverEvent);
    this.emit(`server-${event}`, serverEvent);
  }

  /**
   * Save current server configurations to file
   */
  private async saveConfiguration(): Promise<void> {
    try {
      const mcpServers: Record<string, any> = {};

      for (const [id, connection] of this.connections) {
        const config = connection.config;
        mcpServers[id] = {
          name: config.name,
          command: config.command,
          args: config.args || [],
          env: config.env || {},
          transport: config.transport || "stdio",
          serverUrl: config.serverUrl,
          enabled: config.enabled,
        };
      }

      const configData = {
        mcpServers,
      };

      writeFileSync(this.configFilePath, JSON.stringify(configData, null, 2));
      console.log(`💾 Configuration saved to ${this.configFilePath}`);
    } catch (error) {
      console.error(
        "❌ Error saving configuration:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Set the configuration file path
   */
  setConfigPath(filePath: string): void {
    this.configFilePath = filePath;
  }

  /**
   * Clean up all connections
   */
  async cleanup(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map(
      (serverId) => this.disconnectServer(serverId),
    );

    await Promise.allSettled(disconnectPromises);
    this.connections.clear();
  }
}
