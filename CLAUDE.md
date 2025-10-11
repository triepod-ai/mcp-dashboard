# MCP Dashboard Development Guide

## Build Commands

- Build all: `npm run build`
- Build client: `npm run build-client`
- Build server: `npm run build-server`
- Development mode: `npm run dev` (use `npm run dev:windows` on Windows)
- Production mode: `npm run start` (with authentication enabled)
- Format code: `npm run prettier-fix`
- Client lint: `cd client && npm run lint`

## Publishing to NPM

**Procedure for publishing new versions:**

1. **Update version**: `npm run update-version -- <version>` (e.g., `0.1.3`)
   - This updates all package.json files and rebuilds
2. **Publish**: `npm run publish-all`
   - Publishes all workspace packages and the root package
3. **Commit and tag**:
   ```bash
   git add -A && git commit -m "chore: bump version to <version>"
   git tag v<version>
   git push && git push --tags
   ```
4. **Test**: Wait ~1 minute for NPM CDN, then test with `bunx @bryan-thompson/dashboard@latest`

**IMPORTANT**: Always test with `npm run start` (auth enabled) before publishing, not just `npm run dev` (no auth).

## Lessons Learned

### Server Card Enhancements and Tool Discovery (2025-10-11)

**Feature**: Enhanced server cards with transport type, tool count, and connection details.

**Implementation Details**:

- **Backend**: Enhanced `getStatusSummary()` to include `transport`, `connectionInfo`, and `toolCount`
- **Tool Discovery**: Automatic tool discovery on connection using `transport.send()` directly
- **Frontend**: Server cards display transport badge, tool count, and connection details

**Key Technical Decisions**:

1. **Tool Discovery Method**:
   - Initially tried `client.listTools()` but it timed out (60 second timeout)
   - Switched to direct `transport.send()` with manual message handler
   - Used 5-second timeout for faster feedback
   - Pattern matches the working API endpoint approach

2. **Connection Info Display**:
   - STDIO: Shows command path (e.g., `node build/index.js`)
   - SSE/HTTP: Shows server URL (e.g., `http://localhost:10650/mcp`)
   - Displayed in monospace code block for clarity

3. **Edit Server Functionality**:
   - Added edit button to each server card
   - Dual-mode dialog (Add/Edit) with form pre-population
   - Smart reconnection: only disconnects/reconnects if transport/command/URL changes
   - Added `GET /api/dashboard/servers/:id` endpoint for fetching full config
   - Added `PUT /api/dashboard/servers/:id` endpoint for updates
   - Changes persisted to dashboard-config.json

**Testing Notes**:

- Verified with STDIO, SSE, and Streamable HTTP transports
- Tool count works correctly for all transport types
- chroma-http: 19 tools, qdrant-http: 6 tools (verified)

**Key Takeaway**: When implementing tool discovery, use the direct `transport.send()` approach with manual message handling rather than high-level client methods for better timeout control and reliability.

### Authentication Architecture (2025-10-11)

**Issue**: Dashboard worked in dev mode (`npm run dev --no-auth`) but failed with "Connection error" when running with authentication enabled (`bunx @bryan-thompson/dashboard`).

**Root Cause**:

- Server authentication middleware requires `x-mcp-proxy-auth` header on all API requests
- Client was only sending token with SSE connections (via query parameter)
- All REST API endpoints (`/api/dashboard/*`) were returning 401 Unauthorized

**Solution**:

- Added `getAuthHeaders()` helper in client components
- Updated all `fetch()` calls to include `x-mcp-proxy-auth` header
- Token priority: URL param (`MCP_PROXY_AUTH_TOKEN`) → localStorage → empty string
- Added automatic localStorage clearing on 401 errors

**Key Takeaway**: When adding authentication to a REST API + SSE system, ensure ALL endpoints (not just SSE) receive the auth token in the correct format for each transport (headers for REST, query params for SSE).

## Code Style Guidelines

- Use TypeScript with proper type annotations
- Follow React functional component patterns with hooks
- Use ES modules (import/export) not CommonJS
- Use Prettier for formatting (auto-formatted on commit)
- Follow existing naming conventions:
  - camelCase for variables and functions
  - PascalCase for component names and types
  - kebab-case for file names
- Use async/await for asynchronous operations
- Implement proper error handling with try/catch blocks
- Use Tailwind CSS for styling in the client
- Keep components small and focused on a single responsibility

## Project Organization

The project is organized as a monorepo with workspaces:

- `client/`: React frontend with Vite, TypeScript and Tailwind
- `server/`: Express backend with TypeScript
- `cli/`: Command-line interface for testing and invoking MCP server methods directly
