/**
 * Type guard utilities for runtime type validation
 * Provides safe type checking and validation for assessment modules
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type {
  ExtendedTool,
  JSONSchema,
  JSONSchemaProperty,
  MCPResponse,
  ErrorInfo,
  ToolValidationResult,
} from "@/types/assessment.types";

/**
 * Type guard to check if a value is a valid Tool object
 */
export function isTool(value: unknown): value is Tool {
  if (!value || typeof value !== "object") {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Check required properties
  if (typeof obj.name !== "string") {
    return false;
  }

  // Check inputSchema structure if present
  if (obj.inputSchema && !isValidInputSchema(obj.inputSchema)) {
    return false;
  }

  return true;
}

/**
 * Type guard to check if a tool has an outputSchema property
 */
export function hasOutputSchema(tool: Tool): tool is ExtendedTool {
  return tool && typeof tool === "object" && "outputSchema" in tool;
}

/**
 * Type guard to check if a value is a valid JSON Schema
 */
export function isJSONSchema(value: unknown): value is JSONSchema {
  if (!value || typeof value !== "object") {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Must have type: "object"
  if (obj.type !== "object") {
    return false;
  }

  // Properties must be an object if present
  if (obj.properties && typeof obj.properties !== "object") {
    return false;
  }

  // Required must be an array if present
  if (obj.required && !Array.isArray(obj.required)) {
    return false;
  }

  return true;
}

/**
 * Type guard to check if a value is a valid JSON Schema property
 */
export function isJSONSchemaProperty(value: unknown): value is JSONSchemaProperty {
  if (!value || typeof value !== "object") {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Must have a type field
  if (typeof obj.type !== "string") {
    return false;
  }

  return true;
}

/**
 * Validates a tool's input schema structure
 */
function isValidInputSchema(schema: unknown): boolean {
  if (!schema || typeof schema !== "object") {
    return false;
  }

  const obj = schema as Record<string, unknown>;

  // Must have type: "object"
  if (obj.type !== "object") {
    return false;
  }

  return true;
}

/**
 * Type guard to check if a response is an MCP error response
 */
export function isMCPResponse(value: unknown): value is MCPResponse {
  return value !== null && typeof value === "object";
}

/**
 * Safely extracts error information from a response
 */
export function extractErrorInfo(response: unknown): ErrorInfo {
  if (!isMCPResponse(response)) {
    return {
      isError: false,
      message: "Invalid response format",
    };
  }

  // Check direct isError property (JavaScript exceptions)
  if (response.isError === true) {
    return {
      isError: true,
      message: typeof response.error === "string" ? response.error : "Unknown error",
      code: typeof response.error === "object" && response.error && "code" in response.error
        ? response.error.code as string | number
        : undefined,
    };
  }

  // Check error object structure (proper MCP errors)
  if (response.error && typeof response.error === "object") {
    const error = response.error as Record<string, unknown>;
    return {
      isError: true,
      message: typeof error.message === "string" ? error.message : "Unknown error",
      code: error.code as string | number,
    };
  }

  // Check content array for error indicators
  if (Array.isArray(response.content)) {
    for (const content of response.content) {
      if (content && typeof content === "object" && "type" in content && content.type === "error") {
        return {
          isError: true,
          message: typeof content.text === "string" ? content.text : "Content error",
        };
      }
    }
  }

  return {
    isError: false,
  };
}

/**
 * Checks if a response indicates an error condition
 * This is the critical function that determines if a tool response represents an error
 */
export function isErrorResponse(response: unknown): boolean {
  if (!isMCPResponse(response)) {
    return false;
  }

  // Direct error indicator (JavaScript exceptions caught by callTool)
  if (response.isError === true) {
    return true;
  }

  // Error object present (proper MCP error responses)
  // This is the critical case: { error: { code: -32602, message: "..." } }
  if (response.error) {
    return true;
  }

  // Check content for error indicators
  if (Array.isArray(response.content)) {
    return response.content.some(content =>
      content && typeof content === "object" && "type" in content && content.type === "error"
    );
  }

  return false;
}

/**
 * Comprehensive tool validation with detailed results
 */
export function validateTool(value: unknown): ToolValidationResult {
  const result: ToolValidationResult = {
    isValid: false,
    hasName: false,
    hasInputSchema: false,
    hasValidInputSchema: false,
    hasOutputSchema: false,
    errors: [],
  };

  if (!value || typeof value !== "object") {
    result.errors.push("Tool must be an object");
    return result;
  }

  const obj = value as Record<string, unknown>;

  // Check name property
  if (typeof obj.name === "string") {
    result.hasName = true;
  } else {
    result.errors.push("Tool must have a 'name' property of type string");
  }

  // Check inputSchema property
  if (obj.inputSchema) {
    result.hasInputSchema = true;
    if (isValidInputSchema(obj.inputSchema)) {
      result.hasValidInputSchema = true;
    } else {
      result.errors.push("Tool inputSchema is invalid");
    }
  }

  // Check outputSchema property
  if (obj.outputSchema) {
    result.hasOutputSchema = true;
    if (!isJSONSchema(obj.outputSchema)) {
      result.errors.push("Tool outputSchema is invalid");
    }
  }

  // Tool is valid if it has required properties and no errors
  result.isValid = result.hasName && result.errors.length === 0;

  return result;
}

/**
 * Safely accesses a property from an unknown object
 */
export function safeGetProperty<T>(
  obj: unknown,
  property: string,
  validator: (value: unknown) => value is T
): T | undefined {
  if (!obj || typeof obj !== "object") {
    return undefined;
  }

  const value = (obj as Record<string, unknown>)[property];
  return validator(value) ? value : undefined;
}

/**
 * Type guard for string values
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Type guard for number values
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

/**
 * Type guard for boolean values
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * Type guard for array values
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}