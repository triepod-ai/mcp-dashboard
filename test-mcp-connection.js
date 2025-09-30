#!/usr/bin/env node
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

async function testMCPConnection() {
  console.log("🔍 Testing MCP connection to memory server...");

  try {
    // Create transport - same as our server code
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["@modelcontextprotocol/server-memory"],
      env: process.env,
    });

    console.log("✅ Transport created");

    // Create client - same as our server code
    const client = new Client({
      name: "mcp-test",
      version: "1.0.0"
    }, {
      capabilities: {}
    });

    console.log("✅ Client created");

    // Connect client to transport - same as our server code
    await client.connect(transport);
    console.log("✅ Client connected to transport");

    // List tools - same call that's timing out
    console.log("📡 Calling client.listTools()...");
    const tools = await client.listTools();
    console.log("✅ Tools received:", JSON.stringify(tools, null, 2));

    // Clean up
    await transport.close();
    console.log("✅ Connection closed");

  } catch (error) {
    console.error("💥 Error:", error);
  }
}

testMCPConnection();