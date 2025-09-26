import { useState, useEffect, useRef } from "react";
import type { DashboardStatus } from "@/components/ServerManagementPanel";

export interface SSEEvent {
  type: "connection" | "status" | "server-event" | "proxy-event" | "heartbeat";
  data: any;
}

export interface ConnectionState {
  status: "connecting" | "connected" | "disconnected" | "error";
  error?: string;
  retryCount: number;
  lastConnected?: Date;
}

export interface UseDashboardSSEOptions {
  url: string;
  autoReconnect?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export function useDashboardSSE({
  url,
  autoReconnect = true,
  maxRetries = 5,
  retryDelay = 3000,
}: UseDashboardSSEOptions) {
  const [status, setStatus] = useState<DashboardStatus | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: "disconnected",
    retryCount: 0,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const connect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionState(prev => ({ ...prev, status: "connecting" }));

    try {
      const eventSource = new EventSource(`${url}/sse/dashboard`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (!mountedRef.current) return;

        setConnectionState({
          status: "connected",
          retryCount: 0,
          lastConnected: new Date(),
          error: undefined,
        });

        console.log("📡 Dashboard SSE connected");
      };

      eventSource.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const sseEvent: SSEEvent = JSON.parse(event.data);

          switch (sseEvent.type) {
            case "connection":
              console.log("📡 Dashboard SSE client ID:", sseEvent.data.clientId);
              break;

            case "status":
              setStatus(sseEvent.data);
              break;

            case "server-event":
              console.log("🔔 Server event:", sseEvent.data);
              // Status will be updated in the next status event
              break;

            case "proxy-event":
              console.log("🔗 Proxy event:", sseEvent.data);
              break;

            case "heartbeat":
              // Keep connection alive, no action needed
              break;

            default:
              console.log("📡 Unknown SSE event:", sseEvent);
          }
        } catch (error) {
          console.error("Failed to parse SSE event:", error);
        }
      };

      eventSource.onerror = (error) => {
        if (!mountedRef.current) return;

        console.error("📡 Dashboard SSE error:", error);

        setConnectionState(prev => {
          const newState = {
            ...prev,
            status: "error" as const,
            error: "Connection error",
          };

          // Auto-reconnect if enabled and within retry limits
          if (autoReconnect && prev.retryCount < maxRetries) {
            const delay = retryDelay * Math.pow(2, prev.retryCount); // Exponential backoff
            console.log(`📡 Reconnecting in ${delay}ms (attempt ${prev.retryCount + 1}/${maxRetries})`);

            retryTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                setConnectionState(current => ({
                  ...current,
                  retryCount: current.retryCount + 1,
                }));
                connect();
              }
            }, delay);

            return { ...newState, status: "connecting" as const };
          }

          return newState;
        });
      };

    } catch (error) {
      console.error("Failed to create EventSource:", error);
      setConnectionState(prev => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : "Failed to connect",
      }));
    }
  };

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setConnectionState(prev => ({
      ...prev,
      status: "disconnected",
    }));
  };

  const reconnect = () => {
    disconnect();
    setConnectionState(prev => ({ ...prev, retryCount: 0 }));
    connect();
  };

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [url]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    status,
    connectionState,
    connect,
    disconnect,
    reconnect,
  };
}