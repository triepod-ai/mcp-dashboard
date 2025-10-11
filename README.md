# MCP Dashboard

A web-based management and monitoring interface for multiple Model Context Protocol (MCP) servers. Connect to, manage, and interact with multiple MCP servers simultaneously through a modern React interface with real-time updates.

> **Note**: This project is a fork of the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) by Anthropic, enhanced with multi-server management capabilities.

## Features

- **Multi-Server Management**: Connect to and manage multiple MCP servers simultaneously
- **Server Card Details**: Each server displays transport type, tool count, connection details, and status
- **Edit Server Configuration**: Modify existing server settings without recreating them
- **Real-Time Monitoring**: Server-Sent Events (SSE) for live status updates with automatic tool discovery
- **Tool Execution**: Execute MCP tools with form-based parameter input
- **Resource Explorer**: Browse and read MCP resources with JSON visualization
- **Multi-Transport Support**: STDIO, SSE, and Streamable HTTP transports
- **Dark Mode**: Full theme system with light/dark/system mode support
- **Modern UI**: React 18 interface with Tailwind CSS and shadcn/ui components

## Installation

### Quick Start

Install and run the dashboard using npx:

```bash
npx @bryan-thompson/dashboard
```

The dashboard will start and automatically open in your browser at `http://localhost:6286`.

### From NPM

Install globally:

```bash
npm install -g @bryan-thompson/dashboard
mcp-dashboard
```

### From Source

Clone and build from this repository:

```bash
git clone https://github.com/triepod-ai/dashboard.git
cd dashboard
npm install
npm run build
npm run dev
```

## Usage

### Starting the Dashboard

The dashboard provides a web interface for managing multiple MCP servers:

```bash
# Start with default settings
npx @bryan-thompson/dashboard

# Start in development mode (auto-reload)
npm run dev

# Start on Windows (development)
npm run dev:windows
```

### Connecting to MCP Servers

Once the dashboard is running, you can connect to MCP servers through the web interface:

1. Open the dashboard at `http://localhost:6286`
2. Click "Connect Server" in the sidebar
3. Choose your transport type (STDIO, SSE, or Streamable HTTP)
4. Enter your server configuration
5. Click "Connect"

#### STDIO Transport

For local MCP servers that communicate via standard input/output:

- **Command**: Path to the server executable (e.g., `node`, `python3`)
- **Arguments**: Command arguments (e.g., `build/index.js`)
- **Environment**: Environment variables as key=value pairs

#### SSE Transport

For servers using Server-Sent Events:

- **URL**: The SSE endpoint URL (e.g., `http://localhost:3000/sse`)
- **Authentication**: Optional bearer token

#### Streamable HTTP Transport

For servers using HTTP streaming:

- **URL**: The HTTP endpoint URL (e.g., `http://localhost:3000/mcp`)

### Managing Multiple Servers

The dashboard allows you to:

- Connect to multiple servers simultaneously
- Switch between servers using the sidebar
- View real-time status for each server
- Execute tools on any connected server
- Browse resources from multiple servers
- Monitor server events and notifications

#### Server Cards

Each server card displays comprehensive connection information:

- **Server Name and Status**: Visual indicators for connected/disconnected/error states
- **Transport Type**: Badge showing STDIO, SSE, or STREAMABLE-HTTP
- **Tool Count**: Number of available tools discovered automatically on connection
- **Connection Details**:
  - STDIO servers show the command being executed
  - SSE/HTTP servers show the endpoint URL
- **Last Connected**: Timestamp of the last successful connection
- **Actions**: Connect/Disconnect, Edit configuration, Delete server

The edit button (✏️) allows you to modify server configuration without disconnecting or recreating the server. Changes that affect the connection (transport, command, URL) trigger an automatic reconnect.

## Configuration

### Environment Variables

| Variable      | Description                                     | Default     |
| ------------- | ----------------------------------------------- | ----------- |
| `CLIENT_PORT` | Dashboard web UI port                           | 6286        |
| `SERVER_PORT` | Backend server port                             | 6287        |
| `HOST`        | Bind address (use `0.0.0.0` for network access) | `localhost` |

Example:

```bash
CLIENT_PORT=8080 SERVER_PORT=9000 npx @bryan-thompson/dashboard
```

### Security

The dashboard includes authentication by default. When starting, a session token is generated:

```
🔑 Session token: abc123...
🔗 Open dashboard with token pre-filled:
   http://localhost:6286/?MCP_PROXY_AUTH_TOKEN=abc123...
```

The browser opens automatically with the token pre-filled. The token is saved in localStorage for future sessions.

**Warning**: Do not disable authentication unless you understand the security risks. The dashboard can execute local processes and connect to any MCP server.

## Architecture

The MCP Dashboard is a monorepo with three packages:

- **`@bryan-thompson/dashboard-client`**: React web interface
- **`@bryan-thompson/dashboard-server`**: Express backend for MCP connections
- **`@bryan-thompson/dashboard-cli`**: Command-line interface

```
dashboard/
├── client/          # React frontend (Vite + TypeScript + Tailwind)
├── server/          # Express backend (TypeScript)
├── cli/             # CLI tools (TypeScript)
└── docs/            # Documentation
```

## Development

### Build Commands

```bash
npm run build              # Build all packages
npm run build-client       # Build client only
npm run build-server       # Build server only
npm run dev                # Development mode with hot reload
npm run test               # Run tests
npm run lint               # Lint code
npm run prettier-fix       # Format code
```

### Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Code Style

- TypeScript with strict type checking
- React functional components with hooks
- ES modules (import/export)
- Prettier for formatting
- Tailwind CSS for styling

## Requirements

- Node.js >= 22.7.5
- Modern web browser (Chrome, Firefox, Safari, Edge)

## License

This project is licensed under the MIT License—see the [LICENSE](LICENSE) file for details.

## Acknowledgments

Built on the foundation of [MCP Inspector](https://github.com/modelcontextprotocol/inspector) by Anthropic. All core inspection and debugging features from the original project are preserved and enhanced with multi-server management capabilities.
