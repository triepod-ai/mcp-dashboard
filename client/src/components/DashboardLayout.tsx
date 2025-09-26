import React, { useState } from "react";
import {
  Monitor,
  Server,
  Activity,
  Wrench,
  FileText,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ServerManagementPanel from "./ServerManagementPanel";

export interface DashboardLayoutProps {
  // Future props can be added here
}

const DashboardLayout: React.FC<DashboardLayoutProps> = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navigationItems = [
    {
      id: "overview",
      label: "Overview",
      icon: Monitor,
      component: <div>Dashboard Overview (Coming Soon)</div>,
    },
    {
      id: "servers",
      label: "Servers",
      icon: Server,
      component: <ServerManagementPanel />,
    },
    {
      id: "monitoring",
      label: "Monitoring",
      icon: Activity,
      component: <div>Real-time Monitoring (Coming Soon)</div>,
    },
    {
      id: "tools",
      label: "Tools",
      icon: Wrench,
      component: <div>Tool Execution (Coming Soon)</div>,
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
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`bg-white border-r transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-16"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center space-x-2">
                <Monitor className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900">MCP Dashboard</h1>
              </div>
            )}
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

        {/* Navigation */}
        <div className="p-2">
          <Tabs defaultValue="servers" orientation="vertical" className="w-full">
            <TabsList className={`grid w-full ${sidebarOpen ? 'grid-cols-1' : 'grid-cols-1'} gap-2 bg-transparent`}>
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className={`flex items-center justify-start w-full p-3 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 data-[state=active]:border-blue-200 ${
                      sidebarOpen ? "space-x-3" : "justify-center"
                    }`}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Main Content */}
            <div className="fixed inset-y-0 right-0 left-16 lg:left-64">
              <div className="h-full overflow-auto bg-gray-50">
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
            </div>
          </Tabs>
        </div>

        {/* Sidebar Footer */}
        {sidebarOpen && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-gray-50">
            <div className="text-xs text-gray-500 text-center">
              MCP Dashboard v0.1.0
            </div>
          </div>
        )}
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default DashboardLayout;