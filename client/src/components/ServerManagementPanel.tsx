import React, { useState, useEffect } from "react";
import {
  Plus,
  Play,
  Square,
  Trash2,
  Circle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Monitor,
  Wifi,
  WifiOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Tabs component import removed - not used in this component
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardSSE } from "@/hooks/useDashboardSSE";

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

export interface ServerStatus {
  id: string;
  name: string;
  status: "connecting" | "connected" | "disconnected" | "error";
  lastConnected?: string;
  lastError?: string;
}

export interface DashboardStatus {
  timestamp: string;
  servers: ServerStatus[];
  connections: {
    total: number;
    active: number;
  };
  messageQueue: number;
  connectedServers: number;
  totalServers: number;
  uptime: number;
  memory?: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
}

interface ServerManagementPanelProps {
  dashboardApiUrl?: string;
}

const DEFAULT_API_URL = "http://localhost:6287/api/dashboard";

export const ServerManagementPanel: React.FC<ServerManagementPanelProps> = ({
  dashboardApiUrl = DEFAULT_API_URL,
}) => {
  // Get auth token from URL params or environment
  const urlParams = new URLSearchParams(window.location.search);
  const authToken = urlParams.get('token') ||
    localStorage.getItem('mcp_dashboard_token') ||
    '22c1ba6298f1d4cb49f5afacf957643461e2cb5340ce05ebfd0a4a887e65cac1'; // fallback to current token

  // Use SSE hook for real-time updates
  const { status, connectionState, reconnect } = useDashboardSSE({
    url: dashboardApiUrl.replace('/api/dashboard', ''),
    authToken,
    autoReconnect: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debug logging for status changes
  useEffect(() => {
    console.log("🐛 [ServerManagementPanel] Status changed:", status);
    if (status) {
      console.log("🐛 [ServerManagementPanel] status.servers:", status.servers);
      console.log("🐛 [ServerManagementPanel] status.servers:", status.servers);
      console.log("🐛 [ServerManagementPanel] length check:", status?.servers && status.servers.length > 0);
    }
    console.log("🐛 [ServerManagementPanel] Connection state:", connectionState);
  }, [status, connectionState]);
  const [isAddServerOpen, setIsAddServerOpen] = useState(false);

  const [newServer, setNewServer] = useState<Partial<ServerConfig>>({
    name: "",
    transport: "stdio",
    command: "",
    args: [],
    env: {},
    enabled: true,
  });

  // Handle SSE connection errors
  useEffect(() => {
    if (connectionState.status === "error") {
      setError(connectionState.error || "Connection error");
    } else {
      setError(null);
    }
  }, [connectionState]);

  // Connect to server
  const connectServer = async (serverId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${dashboardApiUrl}/servers/${serverId}/connect`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Failed to connect server: ${response.statusText}`);
      }
      // Status will be updated automatically via SSE
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect server");
    } finally {
      setLoading(false);
    }
  };

  // Disconnect from server
  const disconnectServer = async (serverId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${dashboardApiUrl}/servers/${serverId}/disconnect`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Failed to disconnect server: ${response.statusText}`);
      }
      // Status will be updated automatically via SSE
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect server");
    } finally {
      setLoading(false);
    }
  };

  // Add new server
  const addServer = async () => {
    setLoading(true);
    try {
      // Parse args string to array
      const args = newServer.args && Array.isArray(newServer.args)
        ? newServer.args
        : typeof newServer.args === "string"
          ? (newServer.args as string).split(" ").filter((arg: string) => arg.trim())
          : [];

      const serverConfig = {
        ...newServer,
        args,
        env: newServer.env || {},
      };

      const response = await fetch(`${dashboardApiUrl}/servers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(serverConfig),
      });

      if (!response.ok) {
        throw new Error(`Failed to add server: ${response.statusText}`);
      }

      // Reset form and close dialog
      setNewServer({
        name: "",
        transport: "stdio",
        command: "",
        args: [],
        env: {},
        enabled: true,
      });
      setIsAddServerOpen(false);
      // Status will be updated automatically via SSE
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add server");
    } finally {
      setLoading(false);
    }
  };

  // Remove server
  const removeServer = async (serverId: string) => {
    if (!confirm("Are you sure you want to remove this server?")) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${dashboardApiUrl}/servers/${serverId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Failed to remove server: ${response.statusText}`);
      }
      // Status will be updated automatically via SSE
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove server");
    } finally {
      setLoading(false);
    }
  };

  // SSE connection is handled by the useDashboardSSE hook

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "connecting":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "disconnected":
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      connected: "default",
      connecting: "secondary",
      error: "destructive",
      disconnected: "outline",
    };

    return (
      <Badge variant={variants[status] || "outline"} className="capitalize">
        {status}
      </Badge>
    );
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatMemory = (bytes: number) => {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header with status summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Monitor className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Server Management</h2>
        </div>

        <div className="flex items-center space-x-4">
          {/* Connection Status Indicator */}
          <div className="flex items-center space-x-2">
            {connectionState.status === "connected" ? (
              <div className="flex items-center space-x-1 text-green-600">
                <Wifi className="h-4 w-4" />
                <span className="text-xs">Live</span>
              </div>
            ) : connectionState.status === "connecting" ? (
              <div className="flex items-center space-x-1 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Connecting...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-red-600 cursor-pointer" onClick={reconnect}>
                <WifiOff className="h-4 w-4" />
                <span className="text-xs">Offline</span>
              </div>
            )}
          </div>

          {status && (
            <div className="text-sm text-gray-600 space-x-4">
              <span>Uptime: {formatUptime(status.uptime)}</span>
              <span>Memory: {status.memory ? formatMemory(status.memory.heapUsed) : 'N/A'}</span>
              <span>Servers: {status.connectedServers}/{status.totalServers}</span>
            </div>
          )}

          <Dialog open={isAddServerOpen} onOpenChange={setIsAddServerOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Server
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New MCP Server</DialogTitle>
                <DialogDescription>
                  Configure a new MCP server connection.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Server Name</Label>
                  <Input
                    id="name"
                    value={newServer.name}
                    onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                    placeholder="My MCP Server"
                  />
                </div>

                <div>
                  <Label htmlFor="transport">Transport</Label>
                  <Select
                    value={newServer.transport}
                    onValueChange={(value: "stdio" | "sse" | "streamable-http") =>
                      setNewServer({ ...newServer, transport: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stdio">STDIO</SelectItem>
                      <SelectItem value="sse">Server-Sent Events</SelectItem>
                      <SelectItem value="streamable-http">Streamable HTTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newServer.transport === "stdio" && (
                  <>
                    <div>
                      <Label htmlFor="command">Command</Label>
                      <Input
                        id="command"
                        value={newServer.command}
                        onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                        placeholder="node server.js"
                      />
                    </div>

                    <div>
                      <Label htmlFor="args">Arguments (space separated)</Label>
                      <Input
                        id="args"
                        value={Array.isArray(newServer.args) ? newServer.args.join(" ") : newServer.args}
                        onChange={(e) => setNewServer({
                          ...newServer,
                          args: e.target.value.split(" ").filter(arg => arg.trim())
                        })}
                        placeholder="--port 3000 --env production"
                      />
                    </div>
                  </>
                )}

                {(newServer.transport === "sse" || newServer.transport === "streamable-http") && (
                  <div>
                    <Label htmlFor="serverUrl">Server URL</Label>
                    <Input
                      id="serverUrl"
                      value={newServer.serverUrl || ""}
                      onChange={(e) => setNewServer({ ...newServer, serverUrl: e.target.value })}
                      placeholder="http://localhost:3000/mcp"
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={newServer.enabled}
                    onCheckedChange={(checked) => setNewServer({ ...newServer, enabled: checked })}
                  />
                  <Label>Auto-connect</Label>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsAddServerOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={addServer}
                    disabled={loading || !newServer.name}
                  >
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add Server
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Server list */}
      {connectionState.status === "connecting" ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-gray-600">Loading servers...</span>
            </div>
          </CardContent>
        </Card>
      ) : status?.servers && Array.isArray(status.servers) && status.servers.length > 0 ? (
        <div className="grid gap-4">
          {status.servers.map((server) => (
            <Card key={server.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(server.status)}
                    <div>
                      <h3 className="font-medium">{server.name}</h3>
                      <p className="text-sm text-gray-500">ID: {server.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {getStatusBadge(server.status)}

                    {server.status === "connected" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => disconnectServer(server.id)}
                        disabled={loading}
                      >
                        <Square className="h-4 w-4 mr-1" />
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => connectServer(server.id)}
                        disabled={loading}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Connect
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeServer(server.id)}
                      disabled={loading}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Additional server info */}
                <div className="mt-3 pt-3 border-t text-sm text-gray-600 space-y-1">
                  {server.lastConnected && (
                    <div>Last connected: {new Date(server.lastConnected).toLocaleString()}</div>
                  )}
                  {server.lastError && (
                    <div className="text-red-600">Error: {server.lastError}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Monitor className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">No MCP Servers</h3>
            <p className="mb-4">Add your first MCP server to get started.</p>
            {/* Debug info */}
            <details className="text-left text-xs bg-gray-100 p-2 rounded mt-4">
              <summary className="cursor-pointer">Debug Info</summary>
              <pre className="mt-2 whitespace-pre-wrap">
                Connection State: {connectionState.status}
                {connectionState.error && `Error: ${connectionState.error}`}
                Status Object: {JSON.stringify(status, null, 2)}
                Servers Check: {status?.servers ? 'has servers object' : 'no servers object'}
                Servers Array: {status?.servers ? `array length ${status.servers.length}` : 'no servers array'}
              </pre>
            </details>
            <Button onClick={() => setIsAddServerOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Server
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ServerManagementPanel;