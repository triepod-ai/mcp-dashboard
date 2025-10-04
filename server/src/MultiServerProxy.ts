import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  isJSONRPCRequest,
  isJSONRPCResponse,
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCResponse,
} from "@modelcontextprotocol/sdk/types.js";
import {
  ServerConnectionManager,
  ServerEvent,
} from "./ServerConnectionManager.js";
import { EventEmitter } from "events";

// Extended message interface for our dashboard routing
interface ExtendedJSONRPCMessage {
  serverId?: string;
  [key: string]: any;
}

interface ExtendedJSONRPCRequest {
  serverId?: string;
  [key: string]: any;
}

// Type guard helpers
function hasServerId(message: any): message is { serverId: string } {
  return message && typeof message.serverId === "string";
}

function hasMethod(message: any): message is { method: string } {
  return message && typeof message.method === "string";
}

function hasParams(message: any): message is { params: any } {
  return message && message.params !== undefined;
}

function hasId(message: any): message is { id: string | number } {
  return (
    message &&
    (typeof message.id === "string" || typeof message.id === "number")
  );
}

function getValidId(message: any): string | number {
  if (hasId(message)) {
    return message.id;
  }
  // Generate a fallback ID if none exists
  return `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export interface ProxyMessage {
  serverId?: string; // Target server for request, or source server for response
  message: any;
  timestamp: Date;
}

export interface ProxySession {
  id: string;
  clientTransport: Transport;
  connectedServers: Set<string>;
  messageQueue: ProxyMessage[];
  lastActivity: Date;
}

export class MultiServerProxy extends EventEmitter {
  private serverManager: ServerConnectionManager;
  private sessions: Map<string, ProxySession> = new Map();

  constructor(serverManager: ServerConnectionManager) {
    super();
    this.serverManager = serverManager;

    // Listen to server events
    this.serverManager.on("server-event", this.handleServerEvent.bind(this));
  }

  /**
   * Create a new proxy session for a client
   */
  createSession(sessionId: string, clientTransport: Transport): ProxySession {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    const session: ProxySession = {
      id: sessionId,
      clientTransport,
      connectedServers: new Set(),
      messageQueue: [],
      lastActivity: new Date(),
    };

    this.sessions.set(sessionId, session);
    this.setupClientTransportHandlers(session);

    this.emit("session-created", { sessionId, session });
    return session;
  }

  /**
   * Remove a proxy session
   */
  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        session.clientTransport.close();
      } catch (error) {
        console.warn(
          `Error closing client transport for session ${sessionId}:`,
          error,
        );
      }
      this.sessions.delete(sessionId);
      this.emit("session-removed", { sessionId });
    }
  }

  /**
   * Send a message from client to specific server
   */
  async sendToServer(
    sessionId: string,
    serverId: string,
    message: any,
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.lastActivity = new Date();

    try {
      await this.serverManager.sendToServer(serverId, message);
      session.connectedServers.add(serverId);

      // Queue message for session tracking
      session.messageQueue.push({
        serverId,
        message,
        timestamp: new Date(),
      });

      // Keep only last 1000 messages per session
      if (session.messageQueue.length > 1000) {
        session.messageQueue.shift();
      }

      this.emit("message-sent", { sessionId, serverId, message });
    } catch (error) {
      // Send error response back to client
      if (isJSONRPCRequest(message)) {
        const errorResponse = {
          jsonrpc: "2.0" as const,
          id: message.id,
          error: {
            code: -32001,
            message: `Server ${serverId}: ${error instanceof Error ? error.message : String(error)}`,
            data: {
              serverId,
              error: error instanceof Error ? error.message : String(error),
            },
          },
        };
        await session.clientTransport.send(errorResponse);
      }
      throw error;
    }
  }

  /**
   * Broadcast a message from client to all connected servers
   */
  async broadcastToServers(sessionId: string, message: any): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.lastActivity = new Date();

    const connectedServers = Array.from(
      this.serverManager.getAllConnections().entries(),
    )
      .filter(([_, conn]) => conn.status === "connected")
      .map(([id, _]) => id);

    if (connectedServers.length === 0) {
      if (isJSONRPCRequest(message)) {
        const errorResponse = {
          jsonrpc: "2.0" as const,
          id: message.id,
          error: {
            code: -32002,
            message: "No servers connected",
            data: { availableServers: connectedServers },
          },
        };
        await session.clientTransport.send(errorResponse);
      }
      return;
    }

    const results = await Promise.allSettled(
      connectedServers.map((serverId) =>
        this.sendToServer(sessionId, serverId, message),
      ),
    );

    // Handle failures
    const failures = results
      .map((result, index) => ({ result, serverId: connectedServers[index] }))
      .filter(({ result }) => result.status === "rejected");

    if (failures.length > 0 && isJSONRPCRequest(message)) {
      const errorResponse = {
        jsonrpc: "2.0" as const,
        id: message.id,
        error: {
          code: -32003,
          message: `Failed to send to ${failures.length} servers`,
          data: {
            failures: failures.map(({ serverId, result }) => ({
              serverId,
              error:
                result.status === "rejected"
                  ? result.reason.message
                  : "Unknown error",
            })),
          },
        },
      };
      await session.clientTransport.send(errorResponse);
    }

    this.emit("message-broadcast", { sessionId, message, results });
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): ProxySession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): Map<string, ProxySession> {
    return new Map(this.sessions);
  }

  /**
   * Get proxy statistics
   */
  getStats() {
    const now = new Date();
    const activeSessions = Array.from(this.sessions.values()).filter(
      (session) => now.getTime() - session.lastActivity.getTime() < 300000, // Active in last 5 minutes
    );

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      connectedServers: this.serverManager.getStatusSummary().connected,
      totalServers: this.serverManager.getStatusSummary().total,
      messageQueue: Array.from(this.sessions.values()).reduce(
        (total, session) => total + session.messageQueue.length,
        0,
      ),
    };
  }

  /**
   * Clean up inactive sessions
   */
  cleanupInactiveSessions(maxInactiveTime = 600000): void {
    // 10 minutes default
    const now = new Date();
    const inactiveSessions = Array.from(this.sessions.entries()).filter(
      ([_, session]) =>
        now.getTime() - session.lastActivity.getTime() > maxInactiveTime,
    );

    inactiveSessions.forEach(([sessionId, _]) => {
      this.removeSession(sessionId);
    });

    if (inactiveSessions.length > 0) {
      this.emit("sessions-cleaned", {
        cleaned: inactiveSessions.length,
        remaining: this.sessions.size,
      });
    }
  }

  /**
   * Handle server events and forward to appropriate sessions
   */
  private handleServerEvent(serverEvent: ServerEvent): void {
    if (serverEvent.event === "message") {
      // Forward server messages to all sessions that have communicated with this server
      this.sessions.forEach(async (session) => {
        if (session.connectedServers.has(serverEvent.serverId)) {
          try {
            // Add server identifier to the message
            const messageWithServer = {
              ...serverEvent.data,
              _mcpServer: serverEvent.serverId, // Add server metadata
            };
            await session.clientTransport.send(messageWithServer);
          } catch (error) {
            console.warn(
              `Error forwarding message to session ${session.id}:`,
              error,
            );
          }
        }
      });
    }

    // Forward server status events to all sessions
    this.sessions.forEach(async (session) => {
      try {
        const statusMessage = {
          jsonrpc: "2.0" as const,
          method: "server/status",
          params: {
            serverId: serverEvent.serverId,
            event: serverEvent.event,
            timestamp: serverEvent.timestamp,
            data: serverEvent.data,
          },
        };
        await session.clientTransport.send(statusMessage);
      } catch (error) {
        console.warn(
          `Error forwarding status to session ${session.id}:`,
          error,
        );
      }
    });
  }

  /**
   * Set up client transport event handlers
   */
  private setupClientTransportHandlers(session: ProxySession): void {
    session.clientTransport.onmessage = async (message) => {
      session.lastActivity = new Date();

      try {
        // Check if message has server routing information
        if (hasServerId(message)) {
          // Route to specific server
          await this.sendToServer(session.id, message.serverId, message);
        } else if (
          hasMethod(message) &&
          message.method === "dashboard/servers/list"
        ) {
          // Handle dashboard-specific methods
          const response = {
            jsonrpc: "2.0" as const,
            id: getValidId(message),
            result: this.serverManager.getStatusSummary(),
          };
          await session.clientTransport.send(response);
        } else if (
          hasMethod(message) &&
          message.method === "dashboard/servers/connect"
        ) {
          // Connect to a specific server
          const { serverId } = (hasParams(message) ? message.params : {}) || {};
          if (!serverId) {
            throw new Error("serverId parameter required");
          }
          await this.serverManager.connectServer(serverId);
          const response = {
            jsonrpc: "2.0" as const,
            id: getValidId(message),
            result: { success: true, serverId },
          };
          await session.clientTransport.send(response);
        } else if (
          hasMethod(message) &&
          message.method === "dashboard/servers/disconnect"
        ) {
          // Disconnect from a specific server
          const { serverId } = (hasParams(message) ? message.params : {}) || {};
          if (!serverId) {
            throw new Error("serverId parameter required");
          }
          await this.serverManager.disconnectServer(serverId);
          const response = {
            jsonrpc: "2.0" as const,
            id: getValidId(message),
            result: { success: true, serverId },
          };
          await session.clientTransport.send(response);
        } else {
          // Broadcast to all connected servers by default
          await this.broadcastToServers(session.id, message);
        }
      } catch (error) {
        console.error(
          `Error handling client message in session ${session.id}:`,
          error,
        );

        if (isJSONRPCRequest(message)) {
          const errorResponse = {
            jsonrpc: "2.0" as const,
            id: getValidId(message),
            error: {
              code: -32000,
              message: error instanceof Error ? error.message : String(error),
              data: error instanceof Error ? error.message : String(error),
            },
          };
          await session.clientTransport.send(errorResponse);
        }
      }
    };

    session.clientTransport.onerror = (error) => {
      console.error(`Client transport error in session ${session.id}:`, error);
      this.emit("session-error", { sessionId: session.id, error });
    };

    session.clientTransport.onclose = () => {
      console.log(`Client transport closed for session ${session.id}`);
      this.removeSession(session.id);
    };
  }

  /**
   * Clean up all sessions and resources
   */
  async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.sessions.keys()).map((sessionId) =>
      this.removeSession(sessionId),
    );

    await Promise.allSettled(cleanupPromises);
    this.sessions.clear();
  }
}
