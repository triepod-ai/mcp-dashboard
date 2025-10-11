import React, { useState, useCallback, useEffect } from "react";
import {
  Monitor,
  Server,
  Wrench,
  FileText,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "./ThemeToggle";
import ServerManagementPanel from "./ServerManagementPanel";
import ToolExecutionInterface from "./ToolExecutionInterface";
import HistoryAndNotifications, {
  RequestHistoryItem,
  ServerNotification,
} from "./HistoryAndNotifications";
import { useDashboardSSE } from "@/hooks/useDashboardSSE";

export interface DashboardLayoutProps {
  className?: string;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // History and Notifications state
  const [requestHistory, setRequestHistory] = useState<RequestHistoryItem[]>(
    [],
  );
  const [serverNotifications, setServerNotifications] = useState<
    ServerNotification[]
  >([]);

  // Dashboard API configuration
  const DEFAULT_API_URL = "http://localhost:6287/api/dashboard";
  const urlParams = new URLSearchParams(window.location.search);

  // Get token from URL params or localStorage
  const urlToken = urlParams.get("MCP_PROXY_AUTH_TOKEN") || urlParams.get("token");
  const storedToken = localStorage.getItem("mcp_dashboard_token");
  const authToken = urlToken || storedToken || "";

  // Save URL token to localStorage if provided
  useEffect(() => {
    if (urlToken && urlToken !== storedToken) {
      localStorage.setItem("mcp_dashboard_token", urlToken);
      console.log("💾 Saved auth token to localStorage");
    }
  }, [urlToken, storedToken]);

  // Use SSE hook for real-time server data
  const { serverEvents, clearServerEvents } = useDashboardSSE({
    url: DEFAULT_API_URL.replace("/api/dashboard", ""),
    authToken,
    autoReconnect: true,
  });

  // Convert server events to server notifications
  useEffect(() => {
    const notifications: ServerNotification[] = serverEvents.map((event) => ({
      method: event.type,
      params: event.data,
      server: event.data?.serverId || event.data?.server || "unknown",
      timestamp: event.timestamp,
    }));
    setServerNotifications(notifications);
  }, [serverEvents]);

  // Clear handlers
  const clearHistory = useCallback(() => {
    setRequestHistory([]);
  }, []);

  const clearNotifications = useCallback(() => {
    setServerNotifications([]);
    clearServerEvents();
  }, [clearServerEvents]);

  // Test function to manually create a notification (for testing)
  const addTestNotification = useCallback(() => {
    const testNotification: ServerNotification = {
      method: "test-notification",
      params: {
        message: "This is a test notification",
        timestamp: new Date().toISOString(),
        source: "manual-test",
      },
      server: "test-server",
      timestamp: Date.now(),
    };
    setServerNotifications((prev) => [...prev, testNotification]);
  }, []);

  const navigationItems = [
    {
      id: "overview",
      label: "Overview",
      icon: Monitor,
      component: (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Dashboard Overview</h2>
          <p>Coming Soon...</p>

          {/* Temporary Test Section */}
          <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
            <h3 className="text-lg font-semibold mb-2">🧪 Notification Test</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Test the Server Notifications panel in the bottom section:
            </p>
            <Button onClick={addTestNotification} variant="outline" size="sm">
              Add Test Notification
            </Button>
          </div>
        </div>
      ),
    },
    {
      id: "servers",
      label: "Servers",
      icon: Server,
      component: <ServerManagementPanel />,
    },
    {
      id: "tools",
      label: "Tools",
      icon: Wrench,
      component: <ToolExecutionInterface />,
    },
    {
      id: "resources",
      label: "Resources",
      icon: FileText,
      component: <div>Resource Explorer (Coming Soon)</div>,
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      component: <div>Settings (Coming Soon)</div>,
    },
  ];

  return (
    <Tabs defaultValue="servers" className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={`bg-card border-r border-border transition-all duration-300 flex-shrink-0 flex flex-col ${
          sidebarOpen ? "w-64" : "w-16"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center space-x-2">
                <Monitor className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold text-foreground">
                  MCP Dashboard
                </h1>
              </div>
            )}
            <div className="flex items-center space-x-2">
              {sidebarOpen && <ThemeToggle />}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2"
              >
                {sidebarOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Theme toggle for collapsed sidebar */}
          {!sidebarOpen && (
            <div className="mt-2 flex justify-center">
              <ThemeToggle />
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="p-2 flex-1">
          <TabsList
            className={`grid w-full ${sidebarOpen ? "grid-cols-1" : "grid-cols-1"} gap-2 bg-transparent`}
          >
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  className={`flex items-center justify-start w-full p-3 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground hover:bg-accent/50 transition-colors ${
                    sidebarOpen ? "space-x-3" : "justify-center"
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {sidebarOpen && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Sidebar Footer */}
        {sidebarOpen && (
          <div className="p-4 border-t border-border bg-muted/50">
            <div className="text-xs text-muted-foreground text-center">
              MCP Dashboard v0.1.0
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area with Split Layout */}
      <div className="flex-1 flex flex-col">
        {/* Top Content Area */}
        <div className="flex-1 overflow-auto bg-muted/30 min-h-0">
          <div className="p-6">
            {navigationItems.map((item) => (
              <TabsContent
                key={item.id}
                value={item.id}
                className="mt-0 focus:outline-none"
              >
                {item.component}
              </TabsContent>
            ))}
          </div>
        </div>

        {/* Bottom Panel - History and Notifications */}
        <div
          className="border-t border-border bg-blue-500/20 flex-shrink-0"
          style={{ minHeight: "250px", height: "250px" }}
        >
          <HistoryAndNotifications
            requestHistory={requestHistory}
            serverNotifications={serverNotifications}
            onClearHistory={clearHistory}
            onClearNotifications={clearNotifications}
          />
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </Tabs>
  );
};

export default DashboardLayout;
