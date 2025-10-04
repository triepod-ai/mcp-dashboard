import React, { useState, useEffect } from "react";
import AssessmentTab from "./AssessmentTab";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield } from "lucide-react";
import type { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

interface Server {
  id: string;
  name: string;
  status: "connecting" | "connected" | "disconnected" | "error";
  tools: unknown[];
}

interface AssessmentTabWrapperProps {
  servers?: Server[];
  onCallTool?: (
    serverId: string,
    toolName: string,
    params: Record<string, unknown>,
  ) => Promise<CompatibilityCallToolResult>;
}

const AssessmentTabWrapper: React.FC<AssessmentTabWrapperProps> = ({
  servers = [],
  onCallTool,
}) => {
  const [selectedServerId, setSelectedServerId] = useState<string>("");

  const connectedServers = servers.filter((s) => s.status === "connected");
  const selectedServer = connectedServers.find(
    (s) => s.id === selectedServerId,
  );

  // Auto-select first connected server
  useEffect(() => {
    if (!selectedServerId && connectedServers.length > 0) {
      setSelectedServerId(connectedServers[0].id);
    }
  }, [connectedServers, selectedServerId]);

  // Adapt onCallTool to match AssessmentTab's callTool interface
  const callTool = async (
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<CompatibilityCallToolResult> => {
    console.log(
      `🔧 AssessmentTabWrapper: callTool called for ${toolName} with params:`,
      params,
    );

    if (!selectedServerId || !onCallTool) {
      console.error(
        "❌ AssessmentTabWrapper: No server selected or onCallTool not provided",
      );
      throw new Error("No server selected or onCallTool not provided");
    }

    console.log(
      `📡 AssessmentTabWrapper: Calling onCallTool for server ${selectedServerId}`,
    );
    try {
      const result = await onCallTool(selectedServerId, toolName, params);
      console.log(
        `✅ AssessmentTabWrapper: Tool call successful for ${toolName}:`,
        result,
      );
      return result;
    } catch (error) {
      console.error(
        `❌ AssessmentTabWrapper: Tool call failed for ${toolName}:`,
        error,
      );

      // Convert error to CompatibilityCallToolResult format for consistent error handling
      // This matches the pattern used in App.tsx callTool function
      const toolResult: CompatibilityCallToolResult = {
        content: [
          {
            type: "text",
            text: (error as Error).message ?? String(error),
          },
        ],
        isError: true,
      };
      return toolResult;
    }
  };

  if (connectedServers.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              MCP Server Assessment
            </CardTitle>
            <CardDescription>
              No connected servers available for assessment.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!selectedServer) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              MCP Server Assessment
            </CardTitle>
            <CardDescription>Select a server to assess.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Server</label>
              <select
                value={selectedServerId}
                onChange={(e) => setSelectedServerId(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Select a server...</option>
                {connectedServers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name} ({server.tools?.length || 0} tools)
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Server Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            MCP Server Assessment
          </CardTitle>
          <CardDescription>
            Comprehensive assessment of {selectedServer.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <label className="text-sm font-medium">Selected Server</label>
            <select
              value={selectedServerId}
              onChange={(e) => setSelectedServerId(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              {connectedServers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.name} ({server.tools?.length || 0} tools)
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Assessment Tab */}
      <AssessmentTab
        tools={selectedServer.tools as Tool[]}
        callTool={callTool}
        serverName={selectedServer.name}
      />
    </div>
  );
};

export default AssessmentTabWrapper;
