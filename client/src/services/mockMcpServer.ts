/**
 * Mock MCP Server for Local Development
 * Enables offline testing and faster iteration without real servers
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  ALL_TOOLS_FLAT,
  getToolByName,
  getToolsByCategory,
} from "../fixtures/sampleTools";
import { getResponse, getDefaultResponse } from "../fixtures/sampleResponses";

/**
 * Mock server configuration
 */
export interface MockServerConfig {
  name: string;
  id: string;
  tools: Tool[];
  simulateLatency?: boolean;
  latencyMs?: number;
  failureRate?: number; // 0-1, probability of random failures
  enableLogging?: boolean;
}

/**
 * Mock server instance
 */
export class MockMcpServer {
  private config: MockServerConfig;
  private callLog: Array<{
    timestamp: Date;
    toolName: string;
    params: Record<string, unknown>;
    response: CompatibilityCallToolResult;
    duration: number;
  }> = [];

  constructor(config: MockServerConfig) {
    this.config = {
      simulateLatency: true,
      latencyMs: 100,
      failureRate: 0,
      enableLogging: true,
      ...config,
    };

    if (this.config.enableLogging) {
      console.log(`[MockMCP] Initialized mock server: ${this.config.name}`);
      console.log(
        `[MockMCP] Available tools:`,
        this.config.tools.map((t) => t.name),
      );
    }
  }

  /**
   * Get server info
   */
  getInfo() {
    return {
      id: this.config.id,
      name: this.config.name,
      status: "connected" as const,
      tools: this.config.tools,
    };
  }

  /**
   * Get all tools
   */
  getTools(): Tool[] {
    return this.config.tools;
  }

  /**
   * Call a tool
   */
  async callTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<CompatibilityCallToolResult> {
    const startTime = Date.now();

    if (this.config.enableLogging) {
      console.log(`[MockMCP] Calling tool: ${toolName}`, params);
    }

    // Find the tool
    const tool = this.config.tools.find((t) => t.name === toolName);
    if (!tool) {
      const response: CompatibilityCallToolResult = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Tool not found",
              code: -32601,
              message: `Tool '${toolName}' not found in mock server`,
            }),
          },
        ],
        isError: true,
      };

      this.logCall(toolName, params, response, Date.now() - startTime);
      return response;
    }

    // Simulate latency
    if (this.config.simulateLatency) {
      await this.delay(this.config.latencyMs!);
    }

    // Simulate random failures
    if (
      this.config.failureRate! > 0 &&
      Math.random() < this.config.failureRate!
    ) {
      const response: CompatibilityCallToolResult = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Simulated failure",
              code: -32000,
              message: "Random failure for testing error handling",
            }),
          },
        ],
        isError: true,
      };

      this.logCall(toolName, params, response, Date.now() - startTime);
      return response;
    }

    // Detect scenario based on params
    const scenario = this.detectScenario(toolName, params);

    // Get appropriate response
    let response = getResponse(toolName, scenario, params);

    if (!response) {
      // Fallback to default response
      response = getDefaultResponse(toolName);
    }

    if (!response) {
      // Final fallback: generic success
      response = this.generateGenericResponse(toolName, params);
    }

    this.logCall(toolName, params, response, Date.now() - startTime);

    if (this.config.enableLogging) {
      console.log(`[MockMCP] Response from ${toolName}:`, response);
    }

    return response;
  }

  /**
   * Detect which scenario to use based on parameters
   */
  private detectScenario(
    toolName: string,
    params: Record<string, unknown>,
  ): string {
    // Check for error simulation flags
    if (params.shouldFail === true) {
      return "failure";
    }

    // Check for specific error scenarios
    if (toolName === "get_user_info" && params.userId === "nonexistent") {
      return "not_found";
    }

    // Check for security test patterns
    if (typeof params.path === "string" && params.path.includes("../")) {
      return "path_injection_blocked";
    }

    if (
      typeof params.message === "string" &&
      params.message.toLowerCase().includes("ignore previous")
    ) {
      return "prompt_injection_blocked";
    }

    // Check for validation errors
    if (toolName === "add_numbers") {
      if (typeof params.a !== "number" || typeof params.b !== "number") {
        return "invalid_type";
      }
    }

    // Check for edge cases
    if (typeof params.message === "string" && params.message === "") {
      return "empty_string";
    }

    if (typeof params.message === "string" && params.message.length > 5000) {
      return "very_long_string";
    }

    // Check for missing required parameters
    const tool = getToolByName(toolName);
    if (tool?.inputSchema?.required) {
      const missing = tool.inputSchema.required.filter(
        (req) => !(req in params),
      );
      if (missing.length > 0) {
        return "missing_required";
      }
    }

    // Check for optional parameters
    if (toolName === "get_user_info" && params.includeDetails === true) {
      return "success_with_details";
    }

    // Default to success
    return "success";
  }

  /**
   * Generate a generic success response when no fixture exists
   */
  private generateGenericResponse(
    toolName: string,
    params: Record<string, unknown>,
  ): CompatibilityCallToolResult {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              toolName,
              message: "Mock response - no fixture defined",
              receivedParams: params,
              timestamp: new Date().toISOString(),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  /**
   * Delay helper for simulating latency
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log a tool call
   */
  private logCall(
    toolName: string,
    params: Record<string, unknown>,
    response: CompatibilityCallToolResult,
    duration: number,
  ) {
    this.callLog.push({
      timestamp: new Date(),
      toolName,
      params,
      response,
      duration,
    });

    // Keep log size manageable
    if (this.callLog.length > 100) {
      this.callLog = this.callLog.slice(-100);
    }
  }

  /**
   * Get call history
   */
  getCallHistory() {
    return this.callLog;
  }

  /**
   * Clear call history
   */
  clearCallHistory() {
    this.callLog = [];
  }

  /**
   * Get statistics
   */
  getStats() {
    const totalCalls = this.callLog.length;
    const errorCalls = this.callLog.filter(
      (call) => call.response.isError,
    ).length;
    const successCalls = totalCalls - errorCalls;
    const avgDuration =
      totalCalls > 0
        ? this.callLog.reduce((sum, call) => sum + call.duration, 0) /
          totalCalls
        : 0;

    return {
      totalCalls,
      successCalls,
      errorCalls,
      successRate: totalCalls > 0 ? successCalls / totalCalls : 0,
      avgDuration,
      toolUsage: this.getToolUsageStats(),
    };
  }

  /**
   * Get per-tool usage statistics
   */
  private getToolUsageStats() {
    const usage: Record<string, number> = {};
    this.callLog.forEach((call) => {
      usage[call.toolName] = (usage[call.toolName] || 0) + 1;
    });
    return usage;
  }
}

/**
 * Pre-configured mock servers for common scenarios
 */
export const MOCK_SERVERS = {
  /**
   * Simple server with basic tools
   */
  simple: new MockMcpServer({
    id: "mock-simple",
    name: "Simple Mock Server",
    tools: getToolsByCategory("simple"),
    simulateLatency: true,
    latencyMs: 50,
  }),

  /**
   * Complex server with advanced tools
   */
  complex: new MockMcpServer({
    id: "mock-complex",
    name: "Complex Mock Server",
    tools: getToolsByCategory("complex"),
    simulateLatency: true,
    latencyMs: 200,
  }),

  /**
   * Full server with all sample tools
   */
  full: new MockMcpServer({
    id: "mock-full",
    name: "Full Mock Server",
    tools: ALL_TOOLS_FLAT,
    simulateLatency: true,
    latencyMs: 100,
  }),

  /**
   * Fast server with no latency (for quick testing)
   */
  fast: new MockMcpServer({
    id: "mock-fast",
    name: "Fast Mock Server (No Latency)",
    tools: ALL_TOOLS_FLAT,
    simulateLatency: false,
    enableLogging: false,
  }),

  /**
   * Unreliable server that randomly fails (for resilience testing)
   */
  unreliable: new MockMcpServer({
    id: "mock-unreliable",
    name: "Unreliable Mock Server",
    tools: getToolsByCategory("simple"),
    simulateLatency: true,
    latencyMs: 300,
    failureRate: 0.3, // 30% failure rate
  }),

  /**
   * Security testing server
   */
  security: new MockMcpServer({
    id: "mock-security",
    name: "Security Test Server",
    tools: getToolsByCategory("edgeCase"),
    simulateLatency: true,
    latencyMs: 100,
  }),
};

/**
 * Mock server manager
 */
export class MockServerManager {
  private servers: Map<string, MockMcpServer> = new Map();

  constructor() {
    // Register default mock servers
    Object.entries(MOCK_SERVERS).forEach(([_key, server]) => {
      this.servers.set(server.getInfo().id, server);
    });
  }

  /**
   * Get all mock servers
   */
  getAllServers() {
    return Array.from(this.servers.values()).map((server) => server.getInfo());
  }

  /**
   * Get a specific mock server
   */
  getServer(serverId: string): MockMcpServer | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Add a custom mock server
   */
  addServer(config: MockServerConfig) {
    const server = new MockMcpServer(config);
    this.servers.set(config.id, server);
    return server;
  }

  /**
   * Remove a mock server
   */
  removeServer(serverId: string) {
    return this.servers.delete(serverId);
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(
    serverId: string,
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<CompatibilityCallToolResult> {
    const server = this.getServer(serverId);
    if (!server) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Server not found",
              code: -32000,
              message: `Mock server '${serverId}' not found`,
            }),
          },
        ],
        isError: true,
      };
    }

    return server.callTool(toolName, params);
  }
}

/**
 * Global mock server manager instance
 */
export const mockServerManager = new MockServerManager();

/**
 * Enable/disable mock mode
 */
let mockModeEnabled = false;

export function enableMockMode() {
  mockModeEnabled = true;
  console.log("[MockMCP] Mock mode ENABLED");
}

export function disableMockMode() {
  mockModeEnabled = false;
  console.log("[MockMCP] Mock mode DISABLED");
}

export function isMockModeEnabled() {
  return mockModeEnabled;
}

/**
 * Check if a server ID is a mock server
 */
export function isMockServer(serverId: string): boolean {
  return serverId.startsWith("mock-");
}
