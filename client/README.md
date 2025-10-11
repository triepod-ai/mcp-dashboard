# MCP Dashboard Client

Web-based client interface for the MCP Dashboard - a multi-server management and monitoring tool for Model Context Protocol servers.

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - UI component library

## Development

```bash
# Install dependencies (from root)
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Architecture

The client uses a modern React architecture with:

- **Component-based design** - Reusable UI components in `src/components/`
- **Service layer** - Business logic in `src/services/`
- **Type safety** - Full TypeScript coverage
- **Real-time updates** - Server-Sent Events (SSE) for live monitoring
- **Responsive design** - Works on desktop and mobile

## Key Features

- Multi-server connection management
- Real-time server status monitoring
- Tool execution interface
- Resource exploration
- Dark mode support
- Modern, accessible UI

## Project Structure

```
client/
├── src/
│   ├── components/      # React components
│   │   ├── ui/         # Reusable UI components
│   │   └── ...         # Feature components
│   ├── lib/            # Utilities and helpers
│   ├── services/       # Business logic
│   ├── hooks/          # Custom React hooks
│   └── main.tsx        # Application entry point
├── public/             # Static assets
└── package.json
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) in the project root.
