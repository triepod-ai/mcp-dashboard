import { useState, useCallback, useRef, useEffect } from "react";

// WebSocket message types
interface WebSocketMessage {
  type:
    | "tool-execute"
    | "tool-progress"
    | "tool-result"
    | "tool-error"
    | "tool-cancel";
  executionId: string;
  data: any; // Dynamic WebSocket message data
}

// Tool execution state
interface ToolExecution {
  executionId: string;
  serverId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  status:
    | "preparing"
    | "connecting"
    | "executing"
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
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

interface UseWebSocketToolOptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

interface UseWebSocketToolReturn {
  connected: boolean;
  connecting: boolean;
  execute: (
    serverId: string,
    toolName: string,
    parameters: Record<string, unknown>,
  ) => Promise<string>;
  cancel: (executionId: string) => void;
  executions: Map<string, ToolExecution>;
  connectionError: string | null;
  connect: () => void;
  disconnect: () => void;
}

export const useWebSocketTool = (
  options: UseWebSocketToolOptions = {},
): UseWebSocketToolReturn => {
  const {
    autoConnect = true,
    reconnectAttempts = 3,
    reconnectDelay = 1000,
  } = options;

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [executions, setExecutions] = useState<Map<string, ToolExecution>>(
    new Map(),
  );

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const generateExecutionId = (): string => {
    return `ws-exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const updateExecution = useCallback(
    (executionId: string, updates: Partial<ToolExecution>) => {
      setExecutions((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(executionId);
        if (existing) {
          newMap.set(executionId, { ...existing, ...updates });
        }
        return newMap;
      });
    },
    [],
  );

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log("📨 WebSocket message received:", message);

        const { type, executionId, data } = message;

        switch (type) {
          case "tool-progress":
            updateExecution(executionId, {
              status: "executing",
              progress: {
                message: data.message || "Processing...",
                percentage: data.percentage,
                currentStep: data.currentStep,
                totalSteps: data.totalSteps,
              },
            });
            break;

          case "tool-result":
            updateExecution(executionId, {
              status: "completed",
              result: data.result,
              endTime: new Date(),
              duration:
                Date.now() -
                (executions.get(executionId)?.startTime.getTime() ||
                  Date.now()),
            });
            break;

          case "tool-error":
            updateExecution(executionId, {
              status: "error",
              error: data.error || "Unknown error occurred",
              endTime: new Date(),
              duration:
                Date.now() -
                (executions.get(executionId)?.startTime.getTime() ||
                  Date.now()),
            });
            break;

          default:
            console.warn("Unknown WebSocket message type:", type);
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    },
    [updateExecution, executions],
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || connecting) {
      return;
    }

    setConnecting(true);
    setConnectionError(null);
    // Reset reconnection attempts when manually connecting
    reconnectAttemptsRef.current = 0;

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.hostname}:6287/ws/tools`;
      console.log("🔌 Connecting to WebSocket:", wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ WebSocket connected for tool execution");
        setConnected(true);
        setConnecting(false);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log("🔌 WebSocket disconnected:", event.code, event.reason);
        setConnected(false);
        setConnecting(false);
        wsRef.current = null;

        // Only auto-reconnect for unexpected disconnections, not connection failures
        const shouldReconnect =
          event.wasClean === false &&
          event.code !== 1006 && // Abnormal closure (server unavailable)
          reconnectAttemptsRef.current < reconnectAttempts;

        if (shouldReconnect) {
          reconnectAttemptsRef.current++;
          const delay =
            reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1); // Exponential backoff

          console.log(
            `⏳ Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${reconnectAttempts})`,
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            if (!connected) {
              connect();
            }
          }, delay);
        } else if (reconnectAttemptsRef.current >= reconnectAttempts) {
          setConnectionError(`Connection failed - server may be unavailable`);
        } else if (event.code === 1006) {
          setConnectionError(`Server unavailable`);
        }
      };

      ws.onerror = () => {
        console.warn("🚨 WebSocket connection failed - server may be offline");
        setConnectionError("Server offline - use HTTP mode");
        setConnecting(false);
        // Don't continue trying to reconnect on connection refused
        reconnectAttemptsRef.current = reconnectAttempts;
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setConnectionError("Failed to create WebSocket connection");
      setConnecting(false);
    }
  }, [connecting, connected, handleMessage, reconnectAttempts, reconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "User initiated disconnect");
      wsRef.current = null;
    }

    setConnected(false);
    setConnecting(false);
    reconnectAttemptsRef.current = 0;
  }, []);

  const execute = useCallback(
    async (
      serverId: string,
      toolName: string,
      parameters: Record<string, unknown>,
    ): Promise<string> => {
      if (!connected || !wsRef.current) {
        throw new Error(
          "WebSocket not connected. Use HTTP fallback or connect first.",
        );
      }

      const executionId = generateExecutionId();
      const startTime = new Date();

      // Create execution record
      const execution: ToolExecution = {
        executionId,
        serverId,
        toolName,
        parameters,
        status: "preparing",
        startTime,
      };

      setExecutions((prev) => new Map(prev.set(executionId, execution)));

      // Send execution request
      const message: WebSocketMessage = {
        type: "tool-execute",
        executionId,
        data: {
          serverId,
          toolName,
          parameters,
        },
      };

      updateExecution(executionId, { status: "connecting" });

      wsRef.current.send(JSON.stringify(message));
      console.log("📤 WebSocket tool execution request sent:", message);

      return executionId;
    },
    [connected, updateExecution],
  );

  const cancel = useCallback(
    (executionId: string) => {
      if (!connected || !wsRef.current) {
        console.warn("Cannot cancel: WebSocket not connected");
        return;
      }

      const message: WebSocketMessage = {
        type: "tool-cancel",
        executionId,
        data: {},
      };

      wsRef.current.send(JSON.stringify(message));
      updateExecution(executionId, { status: "cancelled" });
      console.log("🛑 WebSocket tool cancellation sent:", message);
    },
    [connected, updateExecution],
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    connected,
    connecting,
    execute,
    cancel,
    executions,
    connectionError,
    connect,
    disconnect,
  };
};

export default useWebSocketTool;
