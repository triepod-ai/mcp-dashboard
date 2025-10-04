#!/usr/bin/env node
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

async function testMCPWrapper(wrapperScript, serverName) {
  console.log(
    `🔍 Testing MCP connection to ${serverName} via ${wrapperScript}...`,
  );

  try {
    // Create transport using wrapper script - exactly as our server does
    const transport = new StdioClientTransport({
      command: wrapperScript,
      args: [],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        TQDM_DISABLE: "1",
      },
    });

    console.log("✅ Transport created");

    // Create client
    const client = new Client(
      {
        name: "mcp-dashboard",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    console.log("✅ Client created");

    // Connect with timeout
    console.log("🔄 Connecting...");
    await client.connect(transport);
    console.log("✅ Client connected to transport");

    // List tools with timeout
    console.log("📡 Calling client.listTools()...");
    const startTime = Date.now();
    const tools = await client.listTools();
    const duration = Date.now() - startTime;

    console.log(
      `✅ Tools received in ${duration}ms:`,
      tools.tools.length,
      "tools",
    );
    console.log(
      "Tool names:",
      tools.tools.map((t) => t.name),
    );

    // Clean up
    await transport.close();
    console.log("✅ Connection closed");
  } catch (error) {
    console.error(`💥 Error with ${serverName}:`, error.message);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
  }
}

// Test all wrapper scripts
async function testAllWrappers() {
  console.log("🧪 Testing all MCP wrapper scripts...\n");

  await testMCPWrapper("/home/bryan/run-chroma-mcp.sh", "chroma");
  console.log("\n" + "=".repeat(50) + "\n");

  await testMCPWrapper("/home/bryan/run-qdrant-docker-mcp.sh", "qdrant");
  console.log("\n" + "=".repeat(50) + "\n");

  // Test memory server too for comparison
  await testMCPWrapper("npx", "memory");
}

testAllWrappers();
