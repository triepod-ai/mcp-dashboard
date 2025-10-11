import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wrench,
  Play,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
  Wifi,
  WifiOff,
  StopCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import JsonView from "./JsonView";
import { useWebSocketTool } from "../hooks/useWebSocketTool";

interface ToolProperty {
  type: string;
  description?: string;
  enum?: string[];
  format?: string;
  default?: unknown;
  anyOf?: ToolProperty[];
}

interface Tool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, ToolProperty>;
    required?: string[];
  };
}

interface Server {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "error";
  tools?: Tool[];
}

interface ToolExecution {
  serverId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  timestamp: Date;
  status:
    | "preparing"
    | "connecting"
    | "executing"
    | "running"
    | "completed"
    | "error"
    | "cancelled";
  progress?: {
    message: string;
    percentage?: number;
    currentStep?: number;
    totalSteps?: number;
  };
  result?: unknown;
  error?: string;
  executionId?: string;
  duration?: number;
  source?: "websocket" | "http";
}

const ToolExecutionInterface: React.FC = () => {
  // Get auth token from URL params or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const authToken =
    urlParams.get("MCP_PROXY_AUTH_TOKEN") ||
    urlParams.get("token") ||
    localStorage.getItem("mcp_dashboard_token") ||
    "";

  // Helper to create headers with auth token
  const getAuthHeaders = () => {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["x-mcp-proxy-auth"] = authToken;
    }
    return headers;
  };

  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>("");
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [toolParameters, setToolParameters] = useState<Record<string, unknown>>(
    {},
  );
  const [executions, setExecutions] = useState<ToolExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [collapsedExecutions, setCollapsedExecutions] = useState<Set<string>>(
    new Set(),
  );

  // Scroll position preservation for execution history
  const executionHistoryScrollRef = useRef<HTMLDivElement>(null);
  const executionHistoryScrollPosition = useRef<number>(0);

  // WebSocket hook for streaming tool execution (disabled by default for efficiency)
  const {
    connected: wsConnected,
    connecting: wsConnecting,
    execute: wsExecute,
    cancel: wsCancel,
    executions: wsExecutions,
    connectionError: wsError,
    connect: wsConnect,
    disconnect: wsDisconnect,
  } = useWebSocketTool({
    autoConnect: false, // Disable auto-connect to prevent spam
    reconnectAttempts: 2, // Reduce reconnection attempts
    reconnectDelay: 2000, // Increase delay between attempts
  });

  // Fetch server list and their tools (NO AUTH for local dev)
  const fetchServersAndTools = async () => {
    setDiscovering(true);
    try {
      const response = await fetch(
        "http://localhost:6287/api/dashboard/servers",
        {
          headers: getAuthHeaders(),
        },
      );
      const data = await response.json();

      // Fetch tools for each connected server
      const serversWithTools: Server[] = await Promise.all(
        data.servers.map(
          async (server: { id: string; name: string; status: string }) => {
            if (server.status !== "connected") {
              return { ...server, tools: [] };
            }

            try {
              const toolsResponse = await fetch(
                `http://localhost:6287/api/dashboard/servers/${server.id}/tools`,
                {
                  headers: getAuthHeaders(),
                },
              );
              const toolsData = await toolsResponse.json();
              return { ...server, tools: toolsData.tools || [] };
            } catch (error) {
              console.error(
                `Failed to fetch tools for server ${server.id}:`,
                error,
              );
              return { ...server, tools: [] };
            }
          },
        ),
      );

      setServers(serversWithTools);
    } catch (error) {
      console.error("Failed to fetch servers:", error);
    } finally {
      setDiscovering(false);
    }
  };

  useEffect(() => {
    fetchServersAndTools();
    const interval = setInterval(fetchServersAndTools, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Reset parameters when tool changes
  useEffect(() => {
    setToolParameters({});
  }, [selectedTool]);

  // Save scroll position when scrolling
  const handleExecutionHistoryScroll = () => {
    if (executionHistoryScrollRef.current) {
      executionHistoryScrollPosition.current =
        executionHistoryScrollRef.current.scrollTop;
    }
  };

  // Restore scroll position after data updates
  useEffect(() => {
    if (executionHistoryScrollRef.current) {
      executionHistoryScrollRef.current.scrollTop =
        executionHistoryScrollPosition.current;
    }
  }, [executions]);

  // Sync WebSocket executions with local state
  useEffect(() => {
    const wsExecutionArray = Array.from(wsExecutions.values()).map(
      (wsExec) => ({
        serverId: wsExec.serverId,
        toolName: wsExec.toolName,
        parameters: wsExec.parameters,
        timestamp: wsExec.startTime,
        status: wsExec.status,
        progress: wsExec.progress,
        result: wsExec.result,
        error: wsExec.error,
        executionId: wsExec.executionId,
        duration: wsExec.duration,
        source: "websocket" as const,
      }),
    );

    setExecutions((prev) => {
      // Remove old WebSocket executions and add updated ones
      const httpExecutions = prev.filter((exec) => exec.source !== "websocket");
      return [...wsExecutionArray, ...httpExecutions].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
      );
    });
  }, [wsExecutions]);

  const executeTool = async () => {
    if (!selectedServer || !selectedTool) return;

    setLoading(true);

    // Clean up parameters - remove empty strings and null values for optional parameters
    const parameters = Object.keys(toolParameters).reduce(
      (acc, key) => {
        const value = toolParameters[key];
        if (value !== "" && value !== null && value !== undefined) {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, unknown>,
    );

    try {
      // Use HTTP as primary method, WebSocket only when explicitly connected
      if (wsConnected) {
        console.log("📡 Using WebSocket for real-time tool execution");
        const executionId = await wsExecute(
          selectedServer,
          selectedTool,
          parameters,
        );
        console.log("✅ WebSocket execution started:", executionId);
      } else {
        // HTTP is the default method (not a fallback)
        console.log("🔄 Using HTTP API for tool execution");

        const execution: ToolExecution = {
          serverId: selectedServer,
          toolName: selectedTool,
          parameters,
          timestamp: new Date(),
          status: "running",
          source: "http",
        };

        setExecutions((prev) => [execution, ...prev]);

        try {
          const response = await fetch(
            `http://localhost:6287/api/dashboard/servers/${selectedServer}/tools/${selectedTool}/execute`,
            {
              method: "POST",
              headers: getAuthHeaders(),
              body: JSON.stringify({ parameters }),
            },
          );

          const result = await response.json();

          if (!response.ok) {
            // Handle HTTP error responses (including timeouts) as errors
            setExecutions((prev) =>
              prev.map((exec) =>
                exec === execution
                  ? {
                      ...exec,
                      status: "error",
                      error: result.error || `HTTP ${response.status}`,
                    }
                  : exec,
              ),
            );
          } else {
            // Handle successful responses
            setExecutions((prev) =>
              prev.map((exec) =>
                exec === execution
                  ? { ...exec, status: "completed", result }
                  : exec,
              ),
            );
          }
        } catch (error) {
          // Handle network errors or JSON parsing errors
          setExecutions((prev) =>
            prev.map((exec) =>
              exec === execution
                ? { ...exec, status: "error", error: String(error) }
                : exec,
            ),
          );
        }
      }
    } catch (error) {
      console.error("❌ Tool execution failed:", error);

      // Create error execution record for display
      const errorExecution: ToolExecution = {
        serverId: selectedServer,
        toolName: selectedTool,
        parameters,
        timestamp: new Date(),
        status: "error",
        error: String(error),
        source: wsConnected ? "websocket" : "http",
      };

      setExecutions((prev) => [errorExecution, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  const selectedServerData = servers.find((s) => s.id === selectedServer);
  const selectedToolData = selectedServerData?.tools?.find(
    (t) => t.name === selectedTool,
  );

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "preparing":
        return <Loader2 className="h-4 w-4 animate-spin text-gray-500" />;
      case "connecting":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
      case "executing":
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "cancelled":
        return <StopCircle className="h-4 w-4 text-orange-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "preparing":
        return <Badge variant="secondary">Preparing</Badge>;
      case "connecting":
        return (
          <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
            Connecting
          </Badge>
        );
      case "executing":
      case "running":
        return (
          <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
            Running
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
            Completed
          </Badge>
        );
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "cancelled":
        return (
          <Badge className="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200">
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  // Generate form fields based on tool schema
  // Extracted components for better TypeScript inference
  interface ExecutionHeaderProps {
    execution: ToolExecution;
    onCancel: (executionId: string) => void;
    formatTimestamp: (timestamp: Date) => string;
    getStatusIcon: (status: string) => React.ReactNode;
    getStatusBadge: (status: string) => React.ReactNode;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
  }

  const ExecutionHeader: React.FC<ExecutionHeaderProps> = ({
    execution,
    onCancel,
    formatTimestamp,
    getStatusIcon,
    getStatusBadge,
    isCollapsed,
    onToggleCollapse,
  }) => (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleCollapse}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title={isCollapsed ? "Expand details" : "Collapse details"}
        >
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
        {getStatusIcon(execution.status)}
        <span className="font-medium">
          {execution.serverId}.{execution.toolName}
        </span>
        {getStatusBadge(execution.status)}
        {execution.source === "websocket" && (
          <Badge variant="outline" className="text-xs">
            <Wifi className="h-3 w-3 mr-1" />
            WebSocket
          </Badge>
        )}
        {execution.duration && (
          <span className="text-xs text-muted-foreground">
            ({execution.duration}ms)
          </span>
        )}
      </div>
      <div className="flex items-center space-x-2">
        {execution.source === "websocket" &&
          execution.executionId &&
          (execution.status === "preparing" ||
            execution.status === "connecting" ||
            execution.status === "executing") && (
            <Button
              onClick={() =>
                execution.executionId && onCancel(execution.executionId)
              }
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
            >
              <StopCircle className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          )}
        <span className="text-sm text-muted-foreground">
          {formatTimestamp(execution.timestamp)}
        </span>
      </div>
    </div>
  );

  interface ExecutionProgressProps {
    progress: ToolExecution["progress"];
  }

  const ExecutionProgress: React.FC<ExecutionProgressProps> = ({
    progress,
  }) => {
    if (!progress) return null;

    return (
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-blue-700">{progress.message}</span>
          {progress.currentStep && progress.totalSteps && (
            <span className="text-xs text-muted-foreground">
              Step {progress.currentStep} of {progress.totalSteps}
            </span>
          )}
        </div>
        {progress.percentage !== undefined && (
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage ?? 0}%` }}
            />
          </div>
        )}
      </div>
    );
  };

  interface ExecutionParametersProps {
    parameters: ToolExecution["parameters"];
  }

  const ExecutionParameters: React.FC<ExecutionParametersProps> = ({
    parameters,
  }) => (
    <div className="text-sm text-muted-foreground mb-2">
      <p className="font-medium mb-1">Parameters:</p>
      <pre className="bg-muted/50 border p-2 rounded text-xs overflow-x-auto max-w-full whitespace-pre-wrap break-words">
        {JSON.stringify(parameters || {}, null, 2)}
      </pre>
    </div>
  );

  interface ExecutionResultProps {
    result: ToolExecution["result"];
    executionKey: string; // Unique key for this execution result
  }

  const ExecutionResult: React.FC<ExecutionResultProps> = ({
    result,
    executionKey,
  }) => {
    if (!result) return null;

    return (
      <div className="text-sm">
        <p className="text-green-700 font-medium mb-2">Result:</p>
        <JsonView
          data={result}
          className="bg-muted/50 border border-green-200 dark:border-green-800"
          showViewToggle={true}
          defaultViewMode="raw"
          instanceId={`${executionKey}-result`} // Unique instance for expansion state persistence
          key={`${executionKey}-result`} // Stable key preserves JsonView internal state
        />
      </div>
    );
  };

  interface ExecutionErrorProps {
    error: ToolExecution["error"];
  }

  const ExecutionError: React.FC<ExecutionErrorProps> = ({ error }) => {
    if (!error) return null;

    return (
      <div className="text-sm">
        <p className="text-red-700 font-medium mb-2">Error:</p>
        <div className="bg-muted/50 border border-red-200 dark:border-red-800 rounded max-h-32 overflow-auto">
          <pre className="p-3 text-xs whitespace-pre-wrap break-words max-w-full">
            {error || ""}
          </pre>
        </div>
      </div>
    );
  };

  const renderParameterFields = (tool: Tool) => {
    if (!tool.inputSchema?.properties) {
      return (
        <div className="text-sm text-muted-foreground py-4">
          No parameters required for this tool.
        </div>
      );
    }

    const properties = tool.inputSchema.properties;
    const required = tool.inputSchema.required || [];

    return Object.entries(properties).map(([paramName, paramSchema]) => {
      const isRequired = required.includes(paramName);
      const value =
        typeof toolParameters[paramName] === "string"
          ? toolParameters[paramName]
          : "";

      // Handle different parameter types
      const renderField = () => {
        // Handle anyOf schemas (like nullable types)
        let schema = paramSchema;
        if (paramSchema.anyOf) {
          // Find the non-null type
          schema =
            paramSchema.anyOf.find((s: ToolProperty) => s.type !== "null") ||
            paramSchema.anyOf[0];
        }

        const handleChange = (newValue: unknown) => {
          setToolParameters((prev) => ({
            ...prev,
            [paramName]: newValue,
          }));
        };

        switch (schema.type) {
          case "string":
            if (schema.enum) {
              // Dropdown for enum values
              return (
                <Select value={value} onValueChange={handleChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select value..." />
                  </SelectTrigger>
                  <SelectContent>
                    {schema.enum.map((option: string) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            } else if (
              schema.format === "textarea" ||
              schema.description?.includes("long") ||
              schema.description?.includes("text")
            ) {
              // Multi-line text area for long strings
              return (
                <Textarea
                  value={value}
                  onChange={(e) => handleChange(e.target.value)}
                  placeholder={schema.description || `Enter ${paramName}`}
                  rows={3}
                />
              );
            } else {
              // Regular text input
              return (
                <Input
                  type="text"
                  value={value}
                  onChange={(e) => handleChange(e.target.value)}
                  placeholder={schema.description || `Enter ${paramName}`}
                />
              );
            }

          case "number":
          case "integer":
            return (
              <Input
                type="number"
                value={value}
                onChange={(e) => {
                  const numValue =
                    e.target.value === ""
                      ? ""
                      : schema.type === "integer"
                        ? parseInt(e.target.value)
                        : parseFloat(e.target.value);
                  handleChange(numValue);
                }}
                placeholder={schema.description || `Enter ${paramName}`}
                step={schema.type === "integer" ? 1 : 0.01}
              />
            );

          case "boolean":
            return (
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={value === "true"}
                  onCheckedChange={(checked) => handleChange(checked)}
                />
                <span className="text-sm">
                  {schema.description || `Enable ${paramName}`}
                </span>
              </div>
            );

          case "array":
            return (
              <Textarea
                value={
                  Array.isArray(value)
                    ? JSON.stringify(value, null, 2)
                    : typeof value === "string"
                      ? value
                      : ""
                }
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    if (Array.isArray(parsed)) {
                      handleChange(parsed);
                    } else {
                      handleChange(e.target.value);
                    }
                  } catch {
                    handleChange(e.target.value);
                  }
                }}
                placeholder={`JSON array: ${schema.description || `Enter ${paramName} as JSON array`}`}
                rows={3}
              />
            );

          case "object":
            return (
              <Textarea
                value={
                  typeof value === "object"
                    ? JSON.stringify(value, null, 2)
                    : typeof value === "string"
                      ? value
                      : ""
                }
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    handleChange(parsed);
                  } catch {
                    handleChange(e.target.value);
                  }
                }}
                placeholder={`JSON object: ${schema.description || `Enter ${paramName} as JSON object`}`}
                rows={3}
              />
            );

          default:
            // Fallback to text input
            return (
              <Input
                type="text"
                value={
                  typeof value === "string"
                    ? value
                    : typeof value === "number"
                      ? String(value)
                      : ""
                }
                onChange={(e) => handleChange(e.target.value)}
                placeholder={schema.description || `Enter ${paramName}`}
              />
            );
        }
      };

      return (
        <div key={paramName} className="space-y-2">
          <Label htmlFor={paramName} className="text-sm font-medium">
            {paramName}
            {isRequired && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {paramSchema.description && (
            <p className="text-xs text-muted-foreground">
              {paramSchema.description}
            </p>
          )}
          {renderField()}
          {paramSchema.default !== undefined && (
            <p className="text-xs text-muted-foreground">
              Default: {JSON.stringify(paramSchema.default) || "undefined"}
            </p>
          )}
        </div>
      );
    });
  };

  const renderExecutionItem = (
    execution: ToolExecution,
  ): React.ReactElement => {
    // Use stable key based on execution properties instead of array index
    const stableKey = `${execution.timestamp.getTime()}-${execution.toolName}-${execution.serverId}`;
    const isCollapsed = collapsedExecutions.has(stableKey);

    const toggleCollapse = () => {
      setCollapsedExecutions((prev) => {
        const next = new Set(prev);
        if (next.has(stableKey)) {
          next.delete(stableKey);
        } else {
          next.add(stableKey);
        }
        return next;
      });
    };

    return (
      <div
        key={stableKey}
        className="border rounded-lg p-4 max-w-full overflow-hidden"
      >
        <ExecutionHeader
          execution={execution}
          onCancel={wsCancel}
          formatTimestamp={formatTimestamp}
          getStatusIcon={getStatusIcon}
          getStatusBadge={getStatusBadge}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
        {!isCollapsed && (
          <>
            <ExecutionProgress progress={execution.progress} />
            <ExecutionParameters parameters={execution.parameters} />
            <ExecutionResult
              result={execution.result}
              executionKey={`${execution.timestamp.getTime()}-${execution.toolName}`}
            />
            <ExecutionError error={execution.error} />
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-3xl font-bold tracking-tight">Tool Execution</h2>
          {/* WebSocket Connection Status - Optional for real-time features */}
          <div className="flex items-center space-x-2">
            {wsConnected ? (
              <div className="flex items-center space-x-2">
                <div className="flex items-center text-green-600">
                  <Wifi className="h-4 w-4 mr-1" />
                  <span className="text-sm font-medium">Real-time</span>
                </div>
                <button
                  onClick={wsDisconnect}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  title="Disconnect WebSocket to save resources"
                >
                  Disconnect
                </button>
              </div>
            ) : wsConnecting ? (
              <div className="flex items-center text-blue-600">
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                <span className="text-sm font-medium">Connecting...</span>
              </div>
            ) : (
              <button
                onClick={wsConnect}
                className="flex items-center text-muted-foreground hover:text-blue-600 transition-colors px-2 py-1 rounded border border-dashed border-muted-foreground"
                title="Enable real-time tool execution with progress updates"
              >
                <WifiOff className="h-4 w-4 mr-1" />
                <span className="text-sm">Enable Real-time</span>
              </button>
            )}
            {wsError && (
              <span className="text-xs text-red-500" title={wsError}>
                Server offline
              </span>
            )}
          </div>
        </div>
        <Button
          onClick={fetchServersAndTools}
          disabled={discovering}
          variant="outline"
          size="sm"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${discovering ? "animate-spin" : ""}`}
          />
          Refresh Tools
        </Button>
      </div>

      {/* Tool Execution Form */}
      <Card>
        <CardHeader>
          <CardTitle>Execute MCP Tool</CardTitle>
          <CardDescription>
            Select a server and tool to execute with custom parameters.
            {wsConnected ? (
              <span className="text-green-700 ml-2">
                ✨ Real-time mode active - see live progress
              </span>
            ) : (
              <span className="text-muted-foreground ml-2">
                Uses HTTP API (enable real-time for progress updates)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Server</label>
              <Select value={selectedServer} onValueChange={setSelectedServer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a server" />
                </SelectTrigger>
                <SelectContent>
                  {servers
                    .filter((s) => s.status === "connected")
                    .map((server) => (
                      <SelectItem key={server.id} value={server.id}>
                        {server.name} ({server.tools?.length || 0} tools)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Tool</label>
              <Select
                value={selectedTool}
                onValueChange={setSelectedTool}
                disabled={!selectedServer}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a tool" />
                </SelectTrigger>
                <SelectContent>
                  {selectedServerData?.tools?.map((tool) => (
                    <SelectItem key={tool.name} value={tool.name}>
                      {tool.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedToolData && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">{selectedToolData.name}</h4>
              <p className="text-sm text-muted-foreground mb-3">
                {selectedToolData.description}
              </p>

              {selectedToolData.inputSchema &&
                selectedToolData.inputSchema.required &&
                selectedToolData.inputSchema.required.length > 0 && (
                  <div className="text-sm">
                    <p className="font-medium mb-1">Required Parameters:</p>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {selectedToolData.inputSchema.required.map((param) => (
                        <li key={param}>{param}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}

          {selectedToolData && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Parameters</h4>
              {renderParameterFields(selectedToolData)}
            </div>
          )}

          <Button
            onClick={executeTool}
            disabled={!selectedServer || !selectedTool || loading}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            Execute Tool
          </Button>
        </CardContent>
      </Card>

      {/* Execution History */}
      <Card>
        <CardHeader>
          <CardTitle>Execution History</CardTitle>
          <CardDescription>
            Recent tool executions and their results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            ref={executionHistoryScrollRef}
            className="space-y-4 max-h-[70vh] overflow-y-auto"
            onScroll={handleExecutionHistoryScroll}
          >
            {executions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="h-8 w-8 mx-auto mb-2" />
                <p>No tool executions yet</p>
              </div>
            ) : (
              executions.map(renderExecutionItem)
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ToolExecutionInterface;
