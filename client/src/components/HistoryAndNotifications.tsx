import { useState, useRef, useEffect } from "react";
import JsonView from "./JsonView";
import { Button } from "@/components/ui/button";

// Types for dashboard's multi-server architecture
export interface RequestHistoryItem {
  request: string;  // JSON stringified request
  response?: string; // JSON stringified response (optional)
  server?: string;  // Server identifier for multi-server support
  timestamp?: number; // Timestamp for ordering
}

export interface ServerNotification {
  method: string;   // Notification method
  params?: unknown; // Notification parameters (optional to match MCP SDK)
  server?: string;  // Server identifier for multi-server support
  timestamp?: number; // Timestamp for ordering
}

interface HistoryAndNotificationsProps {
  requestHistory: RequestHistoryItem[];
  serverNotifications: ServerNotification[];
  onClearHistory?: () => void;
  onClearNotifications?: () => void;
}

const HistoryAndNotifications = ({
  requestHistory,
  serverNotifications,
  onClearHistory,
  onClearNotifications,
}: HistoryAndNotificationsProps) => {
  // Scroll position preservation refs
  const historyScrollRef = useRef<HTMLDivElement>(null);
  const notificationsScrollRef = useRef<HTMLDivElement>(null);
  const historyScrollPosition = useRef<number>(0);
  const notificationsScrollPosition = useRef<number>(0);

  const [expandedRequests, setExpandedRequests] = useState<{
    [key: number]: boolean;
  }>({});
  const [expandedNotifications, setExpandedNotifications] = useState<{
    [key: number]: boolean;
  }>({});

  const toggleRequestExpansion = (index: number) => {
    setExpandedRequests((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const toggleNotificationExpansion = (index: number) => {
    setExpandedNotifications((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // Save scroll position when scrolling
  const handleHistoryScroll = () => {
    if (historyScrollRef.current) {
      historyScrollPosition.current = historyScrollRef.current.scrollTop;
    }
  };

  const handleNotificationsScroll = () => {
    if (notificationsScrollRef.current) {
      notificationsScrollPosition.current = notificationsScrollRef.current.scrollTop;
    }
  };

  // Restore scroll position after data updates
  useEffect(() => {
    if (historyScrollRef.current) {
      historyScrollRef.current.scrollTop = historyScrollPosition.current;
    }
  }, [requestHistory]);

  useEffect(() => {
    if (notificationsScrollRef.current) {
      notificationsScrollRef.current.scrollTop = notificationsScrollPosition.current;
    }
  }, [serverNotifications]);

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleTimeString();
  };

  const getMethodFromRequest = (requestStr: string) => {
    try {
      const request = JSON.parse(requestStr);
      return request.method || "unknown";
    } catch {
      return "unknown";
    }
  };

  return (
    <div className="bg-card overflow-hidden flex h-full">
      <div
        ref={historyScrollRef}
        className="flex-1 overflow-y-auto p-4 border-r"
        onScroll={handleHistoryScroll}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">History</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearHistory}
            disabled={requestHistory.length === 0}
          >
            Clear
          </Button>
        </div>
        {requestHistory.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No history yet
          </p>
        ) : (
          <ul className="space-y-3">
            {requestHistory
              .slice()
              .reverse()
              .map((request, index) => {
                const actualIndex = requestHistory.length - 1 - index;
                const isExpanded = expandedRequests[actualIndex];

                return (
                  <li
                    key={actualIndex}
                    className="text-sm text-foreground bg-secondary py-2 px-3 rounded"
                  >
                    <div
                      className="flex justify-between items-center cursor-pointer"
                      onClick={() => toggleRequestExpansion(actualIndex)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs">
                            {requestHistory.length - index}.
                          </span>
                          <span className="font-mono truncate">
                            {getMethodFromRequest(request.request)}
                          </span>
                          {request.server && (
                            <span className="text-xs text-muted-foreground bg-muted px-1 rounded">
                              {request.server}
                            </span>
                          )}
                        </div>
                        {request.timestamp && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatTimestamp(request.timestamp)}
                          </div>
                        )}
                      </div>
                      <span className="ml-2">
                        {isExpanded ? "▼" : "▶"}
                      </span>
                    </div>
                    {isExpanded && (
                      <>
                        <div className="mt-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-blue-600">
                              Request:
                            </span>
                          </div>
                          <JsonView
                            data={request.request}
                            className="bg-background"
                            showViewToggle={true}
                          />
                        </div>
                        {request.response && (
                          <div className="mt-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-green-600">
                                Response:
                              </span>
                            </div>
                            <JsonView
                              data={request.response}
                              className="bg-background"
                              showViewToggle={true}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </div>
      <div
        ref={notificationsScrollRef}
        className="flex-1 overflow-y-auto p-4"
        onScroll={handleNotificationsScroll}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Server Notifications</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearNotifications}
            disabled={serverNotifications.length === 0}
          >
            Clear
          </Button>
        </div>
        {serverNotifications.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No notifications yet
          </p>
        ) : (
          <ul className="space-y-3">
            {serverNotifications
              .slice()
              .reverse()
              .map((notification, index) => {
                const actualIndex = serverNotifications.length - 1 - index;
                const isExpanded = expandedNotifications[actualIndex];

                return (
                  <li
                    key={actualIndex}
                    className="text-sm text-foreground bg-secondary py-2 px-3 rounded"
                  >
                    <div
                      className="flex justify-between items-center cursor-pointer"
                      onClick={() => toggleNotificationExpansion(actualIndex)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs">
                            {serverNotifications.length - index}.
                          </span>
                          <span className="font-mono truncate">
                            {notification.method}
                          </span>
                          {notification.server && (
                            <span className="text-xs text-muted-foreground bg-muted px-1 rounded">
                              {notification.server}
                            </span>
                          )}
                        </div>
                        {notification.timestamp && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatTimestamp(notification.timestamp)}
                          </div>
                        )}
                      </div>
                      <span className="ml-2">
                        {isExpanded ? "▼" : "▶"}
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="mt-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-purple-600">
                            Details:
                          </span>
                        </div>
                        <JsonView
                          data={JSON.stringify(notification, null, 2)}
                          className="bg-background"
                          showViewToggle={true}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default HistoryAndNotifications;
