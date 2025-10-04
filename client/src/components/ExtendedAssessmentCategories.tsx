/**
 * Extended Assessment Categories Component
 * Displays extended assessment categories for MCP Directory approval:
 * - MCP Spec Compliance - Essential for consistent Claude integration
 */

import React, { useState } from "react";
import {
  Shield,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MCPSpecComplianceAssessment,
  AssessmentStatus,
} from "@/lib/assessmentTypes";
import JsonView from "./JsonView";

interface ExtendedCategoryProps {
  title: string;
  icon: React.ReactNode;
  status: AssessmentStatus;
  children: React.ReactNode;
  jsonData?: Record<string, unknown>; // Changed from any to unknown for type safety
  defaultExpanded?: boolean;
}

const ExtendedAssessmentCategory: React.FC<ExtendedCategoryProps> = ({
  title,
  icon,
  status,
  children,
  jsonData,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showJson, setShowJson] = useState(false);

  const getStatusBadge = () => {
    switch (status) {
      case "PASS":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            PASS
          </Badge>
        );
      case "FAIL":
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            FAIL
          </Badge>
        );
      case "NEED_MORE_INFO":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            NEEDS INFO
          </Badge>
        );
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <h4 className="font-semibold">{title}</h4>
            {getStatusBadge()}
          </div>
          <div className="flex items-center gap-2">
            {jsonData && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowJson(!showJson);
                  setIsExpanded(true);
                }}
                className="text-xs"
              >
                <Code2 className="h-3 w-3 mr-1" />
                {showJson ? "Hide" : "Show"} JSON
              </Button>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t p-4 bg-muted/20">
          {showJson && jsonData && (
            <div className="bg-background rounded-lg p-3 mb-3 max-h-96 overflow-y-auto">
              <JsonView data={jsonData} />
            </div>
          )}
          <div className={showJson && jsonData ? "mt-3" : ""}>{children}</div>
        </div>
      )}
    </div>
  );
};

interface MCPSpecComplianceProps {
  assessment: MCPSpecComplianceAssessment;
}

export const MCPSpecComplianceDisplay: React.FC<MCPSpecComplianceProps> = ({
  assessment,
}) => {
  return (
    <ExtendedAssessmentCategory
      title="MCP Spec Compliance"
      icon={<Shield className="h-5 w-5 text-blue-600" />}
      status={assessment.status}
      jsonData={assessment}
    >
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800 font-medium mb-1">
            🎯 Critical for Directory Approval
          </p>
          <p className="text-xs text-blue-700">
            Comprehensive validation against MCP protocol specification ensuring
            seamless Claude integration. Prevents workflow breaks, user
            confusion, and reduces support burden for Anthropic.
          </p>
        </div>
        <p className="text-sm">{assessment.explanation}</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">
              Protocol Version
            </label>
            <p className="text-sm font-medium">{assessment.protocolVersion}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              Compliance Score
            </label>
            <p className="text-sm font-medium">
              {assessment.complianceScore.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h5 className="text-sm font-semibold">Transport Compliance</h5>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              HTTP Support:{" "}
              {assessment.transportCompliance.supportsStdio ? "✓" : "✗"}
            </div>
            <div>
              SSE Support:{" "}
              {assessment.transportCompliance.supportsSSE ? "✓" : "✗"}
            </div>
          </div>
        </div>

        {assessment.oauthImplementation && (
          <div className="space-y-2">
            <h5 className="text-sm font-semibold">OAuth Implementation</h5>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                OAuth Support:{" "}
                {assessment.oauthImplementation.supportsOAuth ? "✓" : "✗"}
              </div>
              <div>
                PKCE: {assessment.oauthImplementation.supportsPKCE ? "✓" : "✗"}
              </div>
            </div>
          </div>
        )}

        {assessment.recommendations &&
          assessment.recommendations.length > 0 && (
            <div>
              <h5 className="text-sm font-semibold">Recommendations</h5>
              <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                {assessment.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
      </div>
    </ExtendedAssessmentCategory>
  );
};

// Dynamic Security Display removed - not essential for MCP Directory approval
// This category provided supplemental security testing but was determined
// to be less critical than Supply Chain Security, MCP Spec Compliance, and Privacy Compliance

// Human-in-the-Loop Display removed - not essential for MCP Directory approval
// This category provided workflow enhancement features but was determined
// to be less critical than Supply Chain Security, MCP Spec Compliance, and Privacy Compliance
