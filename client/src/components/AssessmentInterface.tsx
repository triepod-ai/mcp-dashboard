import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Shield,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Download,
  Copy,
  RotateCcw,
  FileText,
  Code2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { MCPAssessmentService } from "@/services/assessmentService";
import {
  MCPDirectoryAssessment,
  AssessmentStatus,
  AssessmentConfiguration,
  DEFAULT_ASSESSMENT_CONFIG,
} from "@/lib/assessmentTypes";
import { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface Server {
  id: string;
  name: string;
  status: "connecting" | "connected" | "disconnected" | "error";
  tools: unknown[];
}

interface AssessmentInterfaceProps {
  servers?: Server[];
  onCallTool?: (
    serverId: string,
    toolName: string,
    params: Record<string, unknown>,
  ) => Promise<CompatibilityCallToolResult>;
}

const AssessmentInterface: React.FC<AssessmentInterfaceProps> = ({
  servers = [],
  onCallTool,
}) => {
  const [selectedServerId, setSelectedServerId] = useState<string>("");
  const [assessment, setAssessment] = useState<MCPDirectoryAssessment | null>(
    null,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTest, setCurrentTest] = useState("");
  const [readmeContent, setReadmeContent] = useState("");
  const [config, setConfig] = useState<AssessmentConfiguration>(
    DEFAULT_ASSESSMENT_CONFIG,
  );
  const [showJson, setShowJson] = useState(false);
  const [showConfiguration, setShowConfiguration] = useState(true);

  const connectedServers = servers.filter((s) => s.status === "connected");
  const selectedServer = connectedServers.find(
    (s) => s.id === selectedServerId,
  );

  const assessmentService = useMemo(
    () => new MCPAssessmentService(config),
    [config],
  );

  // Auto-select first connected server
  useEffect(() => {
    if (!selectedServerId && connectedServers.length > 0) {
      setSelectedServerId(connectedServers[0].id);
    }
  }, [connectedServers, selectedServerId]);

  // Utility function to generate text report
  const generateTextReport = useCallback(
    (assessment: MCPDirectoryAssessment): string => {
      const lines = [
        `MCP Server Assessment Report`,
        `Server: ${assessment.serverName}`,
        `Date: ${new Date(assessment.assessmentDate).toLocaleString()}`,
        `Overall Status: ${assessment.overallStatus}`,
        ``,
        `=== ASSESSMENT SUMMARY ===`,
        assessment.summary,
        ``,
        `=== CORE CATEGORIES ===`,
        `Functionality: ${assessment.functionality.status} (${assessment.functionality.workingTools}/${assessment.functionality.totalTools} tools working)`,
        `Security: ${assessment.security.status} (Risk: ${assessment.security.overallRiskLevel})`,
        `Documentation: ${assessment.documentation.status} (${assessment.documentation.metrics.hasReadme ? "Has README" : "No README"})`,
        `Error Handling: ${assessment.errorHandling.status} (Quality: ${assessment.errorHandling.metrics.errorResponseQuality})`,
        `Usability: ${assessment.usability.status} (Naming: ${assessment.usability.metrics.toolNamingConvention})`,
        ``,
        `=== RECOMMENDATIONS ===`,
        ...assessment.recommendations.map((rec) => `• ${rec}`),
        ``,
        `=== METADATA ===`,
        `Tests Run: ${assessment.totalTestsRun}`,
        `Execution Time: ${assessment.executionTime}ms`,
        `Assessor Version: ${assessment.assessorVersion}`,
      ];
      return lines.join("\n");
    },
    [],
  );

  const copyReport = useCallback(() => {
    if (!assessment) return;
    const report = generateTextReport(assessment);
    navigator.clipboard.writeText(report);
  }, [assessment, generateTextReport]);

  const downloadReport = useCallback(() => {
    if (!assessment) return;
    const report = generateTextReport(assessment);
    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mcp-assessment-${assessment.serverName}-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [assessment, generateTextReport]);

  const downloadJson = useCallback(() => {
    if (!assessment) return;
    const blob = new Blob([JSON.stringify(assessment, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mcp-assessment-${assessment.serverName}-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [assessment]);

  const resetAssessment = useCallback(() => {
    setAssessment(null);
    setError(null);
    setCurrentTest("");
    setShowJson(false);
  }, []);

  const runAssessment = async () => {
    if (!selectedServer || !onCallTool) {
      setError("No server selected or tool calling not available");
      return;
    }

    setIsRunning(true);
    setError(null);
    setAssessment(null);
    setCurrentTest("Initializing assessment...");

    try {
      // Create a wrapper for the callTool function
      const callTool = async (
        name: string,
        params: Record<string, unknown>,
      ): Promise<CompatibilityCallToolResult> => {
        return await onCallTool(selectedServerId, name, params);
      };

      setCurrentTest("Running comprehensive assessment...");

      const result = await assessmentService.runFullAssessment(
        selectedServer.name,
        (selectedServer.tools || []) as any,
        callTool,
        readmeContent || undefined,
      );

      setAssessment(result);
    } catch (err) {
      console.error("Assessment failed:", err);
      setError(err instanceof Error ? err.message : "Assessment failed");
    } finally {
      setIsRunning(false);
      setCurrentTest("");
    }
  };

  const getStatusIcon = (status: AssessmentStatus) => {
    switch (status) {
      case "PASS":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "FAIL":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "NEED_MORE_INFO":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: AssessmentStatus) => {
    const variant =
      status === "PASS"
        ? "default"
        : status === "FAIL"
          ? "destructive"
          : "secondary";
    return (
      <Badge variant={variant} className="ml-2">
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            MCP Server Assessment
          </CardTitle>
          <CardDescription>
            Comprehensive 5-point assessment of MCP servers for functionality,
            security, documentation, error handling, and usability.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Server Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Server</label>
            <select
              value={selectedServerId}
              onChange={(e) => setSelectedServerId(e.target.value)}
              className="w-full p-2 border rounded-md"
              disabled={isRunning}
            >
              <option value="">Select a server...</option>
              {connectedServers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.name} ({server.tools?.length || 0} tools)
                </option>
              ))}
            </select>
          </div>

          {/* Configuration Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfiguration(!showConfiguration)}
                className="p-0 h-auto font-medium text-sm"
              >
                {showConfiguration ? (
                  <ChevronDown className="h-4 w-4 mr-1" />
                ) : (
                  <ChevronUp className="h-4 w-4 mr-1" />
                )}
                Assessment Configuration
              </Button>
            </div>

            {showConfiguration && (
              <div className="space-y-4 pl-4 border-l-2 border-muted">
                <div className="space-y-2">
                  <Label htmlFor="readme">README Content (optional)</Label>
                  <Textarea
                    id="readme"
                    value={readmeContent}
                    onChange={(e) => setReadmeContent(e.target.value)}
                    placeholder="Paste the README content here for documentation assessment..."
                    className="h-32"
                    disabled={isRunning}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="autoTest"
                      checked={config.autoTest}
                      onCheckedChange={(checked) =>
                        setConfig({ ...config, autoTest: !!checked })
                      }
                      disabled={isRunning}
                    />
                    <Label
                      htmlFor="autoTest"
                      className="text-sm"
                      title="Enables testing of all available tools during the assessment. When disabled, only basic validation is performed."
                    >
                      Enable tool testing
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="verboseLogging"
                      checked={config.verboseLogging}
                      onCheckedChange={(checked) =>
                        setConfig({ ...config, verboseLogging: !!checked })
                      }
                      disabled={isRunning}
                    />
                    <Label
                      htmlFor="verboseLogging"
                      className="text-sm"
                      title="Enables detailed logging during assessment execution."
                    >
                      Verbose logging
                    </Label>
                  </div>
                </div>

                {selectedServer &&
                  selectedServer.tools &&
                  selectedServer.tools.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="maxToolsToTest" className="text-sm">
                        Max tools to test for errors (current:{" "}
                        {config.maxToolsToTestForErrors === -1
                          ? "All"
                          : config.maxToolsToTestForErrors}
                        )
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="maxToolsToTest"
                          type="number"
                          value={
                            config.maxToolsToTestForErrors === -1
                              ? selectedServer.tools.length
                              : config.maxToolsToTestForErrors
                          }
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setConfig({
                              ...config,
                              maxToolsToTestForErrors: value,
                            });
                          }}
                          className="w-24"
                          disabled={isRunning}
                          min={0}
                          max={selectedServer.tools.length}
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setConfig({
                                ...config,
                                maxToolsToTestForErrors: -1,
                              })
                            }
                            disabled={isRunning}
                            className="h-8 px-2 text-xs"
                          >
                            All
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setConfig({
                                ...config,
                                maxToolsToTestForErrors: 3,
                              })
                            }
                            disabled={isRunning}
                            className="h-8 px-2 text-xs"
                          >
                            Quick (3)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setConfig({
                                ...config,
                                maxToolsToTestForErrors: Math.ceil(
                                  selectedServer.tools!.length / 2,
                                ),
                              })
                            }
                            disabled={isRunning}
                            className="h-8 px-2 text-xs"
                          >
                            Half ({Math.ceil(selectedServer.tools.length / 2)})
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Limits error handling tests only (the most intensive
                        tests)
                      </p>
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* Assessment Controls */}
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              onClick={runAssessment}
              disabled={
                !selectedServer || isRunning || !selectedServer?.tools?.length
              }
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isRunning ? "Running Assessment..." : "Run Assessment"}
            </Button>

            {/* Parallel Mode Indicator */}
            {config.parallelTesting && (
              <Badge variant="secondary" className="flex items-center gap-1">
                ⚡ Parallel Mode
              </Badge>
            )}

            {assessment && (
              <>
                <Button
                  onClick={resetAssessment}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>

                <Button
                  onClick={copyReport}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy Report
                </Button>

                <Button
                  onClick={downloadReport}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Report
                </Button>

                <Button
                  onClick={downloadJson}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Download JSON
                </Button>

                <Button
                  onClick={() => setShowJson(!showJson)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Code2 className="h-4 w-4" />
                  {showJson ? "Hide JSON" : "View JSON"}
                </Button>
              </>
            )}
          </div>

          {/* Current Test Display */}
          {isRunning && currentTest && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                {config.parallelTesting
                  ? `Running ${config.maxParallelTests || 5} tests in parallel: ${currentTest}`
                  : currentTest}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* JSON View */}
      {assessment && showJson && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5" />
              Assessment JSON Data
            </CardTitle>
            <CardDescription>
              Raw assessment data in JSON format
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-sm">
                <code>{JSON.stringify(assessment, null, 2)}</code>
              </pre>
              <Button
                onClick={() =>
                  navigator.clipboard.writeText(
                    JSON.stringify(assessment, null, 2),
                  )
                }
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assessment Results */}
      {assessment && (
        <div className="space-y-4">
          {/* Overall Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Assessment Results for {assessment.serverName}
                {getStatusBadge(assessment.overallStatus)}
              </CardTitle>
              <CardDescription>
                Completed on{" "}
                {new Date(assessment.assessmentDate).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {assessment.summary}
              </p>

              {/* Core Assessment Areas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium text-sm">Functionality</div>
                    <div className="text-xs text-muted-foreground">
                      {assessment.functionality.workingTools}/
                      {assessment.functionality.totalTools} tools working
                    </div>
                  </div>
                  {getStatusIcon(assessment.functionality.status)}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium text-sm">Security</div>
                    <div className="text-xs text-muted-foreground">
                      Risk: {assessment.security.overallRiskLevel}
                    </div>
                  </div>
                  {getStatusIcon(assessment.security.status)}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium text-sm">Documentation</div>
                    <div className="text-xs text-muted-foreground">
                      {assessment.documentation.metrics.hasReadme
                        ? "Has README"
                        : "No README"}
                    </div>
                  </div>
                  {getStatusIcon(assessment.documentation.status)}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium text-sm">Error Handling</div>
                    <div className="text-xs text-muted-foreground">
                      Quality:{" "}
                      {assessment.errorHandling.metrics.errorResponseQuality}
                    </div>
                  </div>
                  {getStatusIcon(assessment.errorHandling.status)}
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium text-sm">Usability</div>
                    <div className="text-xs text-muted-foreground">
                      Naming:{" "}
                      {assessment.usability.metrics.toolNamingConvention}
                    </div>
                  </div>
                  {getStatusIcon(assessment.usability.status)}
                </div>
              </div>

              {/* Recommendations */}
              {assessment.recommendations.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-2">Recommendations</h4>
                  <ul className="space-y-1">
                    {assessment.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm text-muted-foreground">
                        • {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Assessment Metadata */}
              <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Tests Run: {assessment.totalTestsRun}</span>
                  <span>Execution Time: {assessment.executionTime}ms</span>
                  <span>Assessor Version: {assessment.assessorVersion}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Help Text */}
      {connectedServers.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No connected servers found. Please connect to an MCP server in the
            Servers tab to run assessments.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default AssessmentInterface;
