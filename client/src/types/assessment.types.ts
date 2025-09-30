/**
 * Assessment-specific type definitions
 * Extends MCP SDK types with additional functionality for assessment modules
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { AssessmentConfiguration } from "../lib/assessmentTypes.js";

// Re-export the main AssessmentConfiguration to avoid duplication
export type { AssessmentConfiguration };

// JSON Schema types for runtime validation
export interface JSONSchemaProperty {
  type: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  [key: string]: unknown;
}

export interface JSONSchema {
  type: "object";
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  [key: string]: unknown;
}

// Extended Tool interface with custom properties
export interface ExtendedTool extends Tool {
  outputSchema?: JSONSchema;
  _meta?: Record<string, unknown>;
}

// Type guard result interface
export interface TypeGuardResult<T> {
  isValid: boolean;
  value?: T;
  error?: string;
}

// Assessment context types
export interface CallToolFunction {
  (name: string, params: Record<string, unknown>): Promise<unknown>;
}

// Re-export AssessmentContext interface from AssessmentOrchestrator for test files
export type { AssessmentContext } from "../services/assessment/AssessmentOrchestrator.js";

// Runtime response validation types
export interface MCPResponse {
  isError?: boolean;
  error?: {
    code?: string | number;
    message?: string;
  };
  content?: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

// Error information extraction
export interface ErrorInfo {
  code?: string | number;
  message?: string;
  isError: boolean;
}

// Tool validation results
export interface ToolValidationResult {
  isValid: boolean;
  hasName: boolean;
  hasInputSchema: boolean;
  hasValidInputSchema: boolean;
  hasOutputSchema: boolean;
  errors: string[];
}