/**
 * Mock Server Management Panel
 * Enables/disables mock servers for local development
 */

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  FlaskConical,
  Server,
  CheckCircle,
  XCircle,
  BarChart3,
  Trash2,
} from "lucide-react";
import {
  mockServerManager,
  enableMockMode,
  disableMockMode,
  isMockModeEnabled,
  type MockMcpServer,
} from "../services/mockMcpServer";

interface MockServerPanelProps {
  onServersChanged?: () => void;
}

const MockServerPanel: React.FC<MockServerPanelProps> = ({
  onServersChanged,
}) => {
  const [mockEnabled, setMockEnabled] = useState(isMockModeEnabled());
  const [mockServers, setMockServers] = useState<
    ReturnType<typeof mockServerManager.getAllServers>
  >([]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [serverStats, setServerStats] = useState<
    Record<string, ReturnType<MockMcpServer["getStats"]>>
  >({});

  // Load mock servers on mount
  useEffect(() => {
    refreshServers();
  }, []);

  // Refresh server stats periodically when mock mode is enabled
  useEffect(() => {
    if (!mockEnabled) return;

    const interval = setInterval(() => {
      refreshStats();
    }, 2000);

    return () => clearInterval(interval);
  }, [mockEnabled]);

  const refreshServers = () => {
    const servers = mockServerManager.getAllServers();
    setMockServers(servers);
  };

  const refreshStats = () => {
    const stats: Record<string, ReturnType<MockMcpServer["getStats"]>> = {};
    mockServers.forEach((serverInfo) => {
      const server = mockServerManager.getServer(serverInfo.id);
      if (server) {
        stats[serverInfo.id] = server.getStats();
      }
    });
    setServerStats(stats);
  };

  const handleToggleMockMode = (enabled: boolean) => {
    if (enabled) {
      enableMockMode();
      setMockEnabled(true);
      onServersChanged?.();
    } else {
      disableMockMode();
      setMockEnabled(false);
      onServersChanged?.();
    }
  };

  const handleClearHistory = (serverId: string) => {
    const server = mockServerManager.getServer(serverId);
    if (server) {
      server.clearCallHistory();
      refreshStats();
    }
  };

  const selectedServerInfo = mockServers.find((s) => s.id === selectedServer);
  const selectedStats = selectedServer ? serverStats[selectedServer] : null;

  return (
    <div className="space-y-6">
      {/* Mock Mode Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Mock Server Mode
          </CardTitle>
          <CardDescription>
            Enable mock servers for local development and testing without real
            MCP servers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="mock-mode">Enable Mock Mode</Label>
              <p className="text-sm text-muted-foreground">
                Use simulated servers with pre-defined responses
              </p>
            </div>
            <Switch
              id="mock-mode"
              checked={mockEnabled}
              onCheckedChange={handleToggleMockMode}
            />
          </div>

          {mockEnabled && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                Mock mode is active - {mockServers.length} mock servers
                available
              </div>
            </div>
          )}

          {!mockEnabled && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="h-4 w-4" />
                Mock mode is disabled
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mock Server List */}
      {mockEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Available Mock Servers
            </CardTitle>
            <CardDescription>
              Pre-configured mock servers for different testing scenarios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockServers.map((server) => {
                const stats = serverStats[server.id];
                return (
                  <div
                    key={server.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedServer === server.id
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/50"
                    }`}
                    onClick={() => setSelectedServer(server.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{server.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {server.tools.length} tools
                        </Badge>
                      </div>
                      <Badge
                        variant="default"
                        className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                      >
                        Connected
                      </Badge>
                    </div>

                    {stats && (
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>
                          Calls: <strong>{stats.totalCalls}</strong>
                        </span>
                        <span>
                          Success: <strong>{stats.successCalls}</strong>
                        </span>
                        <span>
                          Errors: <strong>{stats.errorCalls}</strong>
                        </span>
                        <span>
                          Avg: <strong>{stats.avgDuration.toFixed(0)}ms</strong>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Server Details */}
      {mockEnabled && selectedServer && selectedServerInfo && selectedStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Server Statistics - {selectedServerInfo.name}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClearHistory(selectedServer)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear History
              </Button>
            </CardTitle>
            <CardDescription>
              Detailed statistics and tool usage for this mock server
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 border rounded-lg">
                <div className="text-2xl font-bold">
                  {selectedStats.totalCalls}
                </div>
                <div className="text-xs text-muted-foreground">Total Calls</div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {selectedStats.successCalls}
                </div>
                <div className="text-xs text-muted-foreground">Successful</div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {selectedStats.errorCalls}
                </div>
                <div className="text-xs text-muted-foreground">Errors</div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-2xl font-bold">
                  {(selectedStats.successRate * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  Success Rate
                </div>
              </div>
            </div>

            {/* Average Duration */}
            <div className="p-4 border rounded-lg bg-muted/30">
              <div className="text-sm font-medium mb-1">
                Average Response Time
              </div>
              <div className="text-3xl font-bold">
                {selectedStats.avgDuration.toFixed(0)}
                <span className="text-lg text-muted-foreground ml-1">ms</span>
              </div>
            </div>

            {/* Tool Usage */}
            {Object.keys(selectedStats.toolUsage).length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3">
                  Tool Usage Breakdown
                </h4>
                <div className="space-y-2">
                  {Object.entries(selectedStats.toolUsage)
                    .sort(([, a], [, b]) => b - a)
                    .map(([toolName, count]) => (
                      <div
                        key={toolName}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm font-mono">{toolName}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{
                                width: `${(count / selectedStats.totalCalls) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium w-8 text-right">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MockServerPanel;
