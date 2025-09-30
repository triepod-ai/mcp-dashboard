/**
 * Error Handling Assessor Module
 * Tests error handling and input validation
 */

import {
  ErrorHandlingAssessment,
  ErrorHandlingMetrics,
  ErrorTestDetail,
  AssessmentStatus,
} from "@/lib/assessmentTypes";
import { BaseAssessor } from "./BaseAssessor";
import { AssessmentContext } from "../AssessmentOrchestrator";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { isTool, isErrorResponse, extractErrorInfo, isJSONSchemaProperty, isJSONSchema, safeGetProperty } from "@/utils/typeGuards";

export class ErrorHandlingAssessor extends BaseAssessor {
  async assess(context: AssessmentContext): Promise<ErrorHandlingAssessment> {
    this.log("Starting error handling assessment");

    const testDetails: ErrorTestDetail[] = [];

    // Test a sample of tools for error handling
    const toolsToTest = this.selectToolsForTesting(context.tools);

    for (const tool of toolsToTest) {
      const toolTests = await this.testToolErrorHandling(
        tool,
        context.callTool,
      );
      testDetails.push(...toolTests);
    }

    this.testCount = testDetails.length;

    const metrics = this.calculateMetrics(testDetails);
    const status = this.determineErrorHandlingStatus(metrics);
    const explanation = this.generateExplanation(metrics, testDetails);
    const recommendations = this.generateRecommendations(metrics, testDetails);

    return {
      metrics,
      status,
      explanation,
      recommendations,
    };
  }

  private selectToolsForTesting(tools: Tool[]): Tool[] {
    // Filter to only valid tools
    const validTools = tools.filter(isTool);

    // Use configuration to determine how many tools to test
    const configLimit = this.config.maxToolsToTestForErrors;

    // If -1, test all tools
    if (configLimit === -1) {
      this.log(`Testing all ${validTools.length} tools for error handling`);
      return validTools;
    }

    // Otherwise use the configured limit (default to 5 if not set)
    const maxTools = Math.min(configLimit ?? 5, validTools.length);
    this.log(
      `Testing ${maxTools} out of ${validTools.length} tools for error handling`,
    );
    return validTools.slice(0, maxTools);
  }

  private async testToolErrorHandling(
    tool: Tool,
    callTool: (name: string, params: Record<string, unknown>) => Promise<unknown>,
  ): Promise<ErrorTestDetail[]> {
    const tests: ErrorTestDetail[] = [];

    // Test 1: Missing required parameters
    tests.push(await this.testMissingParameters(tool, callTool));

    // Test 2: Wrong parameter types
    tests.push(await this.testWrongTypes(tool, callTool));

    // Test 3: Invalid parameter values
    tests.push(await this.testInvalidValues(tool, callTool));

    // Test 4: Excessive input size
    tests.push(await this.testExcessiveInput(tool, callTool));

    return tests;
  }

  private async testMissingParameters(
    tool: Tool,
    callTool: (name: string, params: Record<string, unknown>) => Promise<unknown>,
  ): Promise<ErrorTestDetail> {
    const testInput = {}; // Empty params

    // Check if tool has required parameters
    const schema = this.getToolSchema(tool);
    let hasRequiredParams = false;

    if (isJSONSchema(schema) && schema.required && Array.isArray(schema.required)) {
      hasRequiredParams = schema.required.length > 0;
    }

    // If tool has no required parameters, it should accept empty params (test passes)
    if (!hasRequiredParams) {
      return {
        toolName: tool.name,
        testType: "missing_required",
        testInput,
        expectedError: "Tool has no required parameters",
        actualResponse: {
          isError: false,
          errorMessage: "Tool correctly accepts empty parameters (no required params)",
          rawResponse: "N/A - no required parameters to test",
        },
        passed: true,
        reason: undefined,
      };
    }

    try {
      const response = await this.executeWithTimeout(
        callTool(tool.name, testInput),
        5000,
      );

      const isError = isErrorResponse(response);
      const errorInfo = extractErrorInfo(response);

      // Enhanced error pattern detection with debugging
      const errorMessage = errorInfo.message ?? "";
      const messageLower = errorMessage.toLowerCase();

      // Debug logging to help identify why tests fail
      this.log(`[DEBUG] Tool: ${tool.name}, Error detected: ${isError}, Message: "${errorMessage}"`);

      // Comprehensive pattern matching for missing parameter errors
      const missingParameterPatterns = [
        // Common MCP error patterns
        /missing.*required/i,
        /required.*missing/i,
        /required.*parameter/i,
        /parameter.*required/i,

        // MCP error codes
        /-32602/,
        /invalid.*param/i,

        // Generic validation patterns
        /must.*provide/i,
        /must.*be.*provided/i,
        /cannot.*be.*empty/i,
        /must.*specify/i,
        /is.*required/i,
        /field.*required/i,

        // Specific field validation
        /\b(query|field|parameter|argument|value|input|name|id|message|data)\b.*\b(required|missing|needed)\b/i,
        /\b(required|missing|needed)\b.*\b(query|field|parameter|argument|value|input|name|id|message|data)\b/i,

        // Validation framework messages
        /validation.*fail/i,
        /validation.*error/i,
        /schema.*validation/i,
        /invalid.*input/i,
        /bad.*request/i,
      ];

      const hasValidErrorPattern = missingParameterPatterns.some(pattern =>
        pattern.test(errorMessage)
      );

      // Accept any error response that indicates parameter validation
      const hasValidError = isError && (
        hasValidErrorPattern ||
        messageLower.includes("required") ||
        messageLower.includes("missing") ||
        messageLower.includes("must provide") ||
        messageLower.includes("must be provided") ||
        messageLower.includes("is required") ||
        messageLower.includes("cannot be empty") ||
        messageLower.includes("must specify") ||
        messageLower.includes("-32602") ||
        messageLower.includes("invalid param") ||
        messageLower.includes("parameter") && messageLower.includes("required") ||
        messageLower.includes("field") && messageLower.includes("required") ||
        messageLower.includes("validation")
      );

      // Additional debug logging
      if (isError && !hasValidError) {
        this.log(`[DEBUG] Error detected but doesn't match patterns: "${errorMessage}"`);
      }

      return {
        toolName: tool.name,
        testType: "missing_required",
        testInput,
        expectedError: "Missing required parameters",
        actualResponse: {
          isError,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
          rawResponse: response,
        },
        passed: hasValidError,
        reason: isError ? (hasValidError ? undefined : "Error message doesn't indicate parameter validation") : "Tool did not reject missing parameters",
      };
    } catch (error) {
      // Check if the error message is meaningful (not just a generic crash)
      const errorMessage = this.extractErrorMessage(error);
      const messageLower = errorMessage?.toLowerCase() ?? "";

      // More comprehensive validation error detection for exceptions
      const isMeaningfulError =
        messageLower.includes("required") ||
        messageLower.includes("missing") ||
        messageLower.includes("parameter") ||
        messageLower.includes("must") ||
        messageLower.includes("invalid") ||
        messageLower.includes("validation") ||
        messageLower.includes("-32602") ||
        messageLower.includes("bad request") ||
        errorMessage?.length > 20; // Longer messages are likely intentional

      return {
        toolName: tool.name,
        testType: "missing_required",
        testInput,
        expectedError: "Missing required parameters",
        actualResponse: {
          isError: true,
          errorMessage: errorMessage,
          rawResponse: error,
        },
        passed: isMeaningfulError,
        reason: isMeaningfulError ? undefined : "Generic unhandled exception",
      };
    }
  }

  private async testWrongTypes(
    tool: Tool,
    callTool: (name: string, params: Record<string, unknown>) => Promise<unknown>,
  ): Promise<ErrorTestDetail> {
    const schema = this.getToolSchema(tool);

    // Check if tool has any parameters to test types for
    let hasParameters = false;
    if (isJSONSchema(schema) && schema.properties) {
      hasParameters = Object.keys(schema.properties).length > 0;
    }

    // If tool has no parameters, there are no types to validate (test passes)
    if (!hasParameters) {
      return {
        toolName: tool.name,
        testType: "wrong_type",
        testInput: {},
        expectedError: "Tool has no parameters to validate types for",
        actualResponse: {
          isError: false,
          errorMessage: "Tool has no parameters to test wrong types (N/A)",
          rawResponse: "N/A - no parameters to test types for",
        },
        passed: true,
        reason: undefined,
      };
    }

    const testInput = this.generateWrongTypeParams(schema);

    try {
      const response = await this.executeWithTimeout(
        callTool(tool.name, testInput),
        5000,
      );

      const isError = isErrorResponse(response);
      const errorInfo = extractErrorInfo(response);

      // More intelligent pattern matching for type errors
      const messageLower = errorInfo.message?.toLowerCase() ?? "";
      const hasValidError =
        isError &&
        (messageLower.includes("type") ||
          messageLower.includes("invalid") ||
          messageLower.includes("expected") ||
          messageLower.includes("must be") ||
          messageLower.includes("should be") ||
          messageLower.includes("cannot be") ||
          messageLower.includes("not a") ||
          messageLower.includes("received") ||
          messageLower.includes("string") ||
          messageLower.includes("number") ||
          messageLower.includes("boolean") ||
          messageLower.includes("array") ||
          messageLower.includes("object") ||
          messageLower.includes("-32602") ||
          // Also accept validation framework messages
          /\b(validation|validate|schema|format)\b/i.test(
            errorInfo.message ?? "",
          ));

      return {
        toolName: tool.name,
        testType: "wrong_type",
        testInput,
        expectedError: "Type validation error",
        actualResponse: {
          isError,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
          rawResponse: response,
        },
        passed: hasValidError,
        reason: isError ? (hasValidError ? undefined : "Error doesn't indicate type validation") : "Tool accepted wrong parameter types",
      };
    } catch (error) {
      // Check if the error message is meaningful (not just a generic crash)
      const errorMessage = this.extractErrorMessage(error);
      const messageLower = errorMessage?.toLowerCase() ?? "";
      const isMeaningfulError =
        messageLower.includes("type") ||
        messageLower.includes("invalid") ||
        messageLower.includes("expected") ||
        messageLower.includes("must be") ||
        messageLower.includes("validation") ||
        messageLower.includes("string") ||
        messageLower.includes("number") ||
        messageLower.includes("-32602") ||
        errorMessage?.length > 20; // Longer messages are likely intentional

      return {
        toolName: tool.name,
        testType: "wrong_type",
        testInput,
        expectedError: "Type validation error",
        actualResponse: {
          isError: true,
          errorMessage: errorMessage,
          rawResponse: error,
        },
        passed: isMeaningfulError,
        reason: isMeaningfulError ? undefined : "Generic unhandled exception",
      };
    }
  }

  private async testInvalidValues(
    tool: Tool,
    callTool: (name: string, params: Record<string, unknown>) => Promise<unknown>,
  ): Promise<ErrorTestDetail> {
    const schema = this.getToolSchema(tool);

    // Check if tool has any parameters to test invalid values for
    let hasParameters = false;
    if (isJSONSchema(schema) && schema.properties) {
      hasParameters = Object.keys(schema.properties).length > 0;
    }

    // If tool has no parameters, there are no values to validate (test passes)
    if (!hasParameters) {
      return {
        toolName: tool.name,
        testType: "invalid_values",
        testInput: {},
        expectedError: "Tool has no parameters to validate values for",
        actualResponse: {
          isError: false,
          errorMessage: "Tool has no parameters to test invalid values (N/A)",
          rawResponse: "N/A - no parameters to test values for",
        },
        passed: true,
        reason: undefined,
      };
    }

    const testInput = this.generateInvalidValueParams(schema);

    try {
      const response = await this.executeWithTimeout(
        callTool(tool.name, testInput),
        5000,
      );

      const isError = isErrorResponse(response);
      const errorInfo = extractErrorInfo(response);

      // For invalid values, any error response is good
      // The server is validating inputs properly
      return {
        toolName: tool.name,
        testType: "invalid_values",
        testInput,
        expectedError: "Invalid parameter values",
        actualResponse: {
          isError,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
          rawResponse: response,
        },
        passed: isError,
        reason: isError ? undefined : "Tool accepted invalid values",
      };
    } catch (error) {
      // Check if the error message is meaningful (not just a generic crash)
      const errorMessage = this.extractErrorMessage(error);
      const messageLower = errorMessage?.toLowerCase() ?? "";
      const isMeaningfulError =
        messageLower.includes("invalid") ||
        messageLower.includes("not allowed") ||
        messageLower.includes("must") ||
        messageLower.includes("cannot") ||
        messageLower.includes("validation") ||
        messageLower.includes("error") ||
        messageLower.includes("-32602") ||
        errorMessage?.length > 15; // Even shorter messages OK for invalid values

      return {
        toolName: tool.name,
        testType: "invalid_values",
        testInput,
        expectedError: "Invalid parameter values",
        actualResponse: {
          isError: true,
          errorMessage: errorMessage,
          rawResponse: error,
        },
        passed: isMeaningfulError,
        reason: isMeaningfulError ? undefined : "Generic unhandled exception",
      };
    }
  }

  private async testExcessiveInput(
    tool: Tool,
    callTool: (name: string, params: Record<string, unknown>) => Promise<unknown>,
  ): Promise<ErrorTestDetail> {
    const schema = this.getToolSchema(tool);

    // Check if tool has any string parameters to test input size for
    let hasStringParameters = false;
    if (isJSONSchema(schema) && schema.properties) {
      for (const prop of Object.values(schema.properties)) {
        if (isJSONSchemaProperty(prop) && prop.type === "string") {
          hasStringParameters = true;
          break;
        }
      }
    }

    // If tool has no string parameters, there are no string inputs to test size limits for
    if (!hasStringParameters) {
      return {
        toolName: tool.name,
        testType: "excessive_input",
        testInput: {},
        expectedError: "Tool has no string parameters to test input size limits",
        actualResponse: {
          isError: false,
          errorMessage: "Tool has no string parameters to test excessive input (N/A)",
          rawResponse: "N/A - no string parameters to test input size for",
        },
        passed: true,
        reason: undefined,
      };
    }

    const largeString = "x".repeat(100000); // 100KB string
    const testInput = this.generateParamsWithValue(tool, largeString);

    try {
      const response = await this.executeWithTimeout(
        callTool(tool.name, testInput),
        5000,
      );

      const isError = isErrorResponse(response);
      const errorInfo = extractErrorInfo(response);

      return {
        toolName: tool.name,
        testType: "excessive_input",
        testInput: { ...testInput, value: "[100KB string]" }, // Don't store huge string
        expectedError: "Input size limit exceeded",
        actualResponse: {
          isError,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
          rawResponse: response ? "[response omitted]" : undefined,
        },
        passed: isError || response !== null, // Either error or handled gracefully
        reason:
          !isError && !response ? "Tool crashed on large input" : undefined,
      };
    } catch (error) {
      // Check if the error message is meaningful (not just a generic crash)
      const errorMessage = this.extractErrorMessage(error);
      const messageLower = errorMessage?.toLowerCase() ?? "";
      const isMeaningfulError =
        messageLower.includes("size") ||
        messageLower.includes("large") ||
        messageLower.includes("limit") ||
        messageLower.includes("exceed") ||
        messageLower.includes("too") ||
        messageLower.includes("maximum") ||
        errorMessage?.length > 10; // Short messages OK for size limits

      return {
        toolName: tool.name,
        testType: "excessive_input",
        testInput: { value: "[100KB string]" },
        expectedError: "Input size limit exceeded",
        actualResponse: {
          isError: true,
          errorMessage: errorMessage,
          rawResponse: "[error details omitted]",
        },
        passed: isMeaningfulError,
        reason: isMeaningfulError ? undefined : "Generic unhandled exception",
      };
    }
  }

  private getToolSchema(tool: Tool): unknown {
    if (!tool.inputSchema) return {};
    return typeof tool.inputSchema === "string"
      ? this.safeJsonParse(tool.inputSchema)
      : tool.inputSchema;
  }

  private generateWrongTypeParams(schema: unknown): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    if (!isJSONSchema(schema) || !schema.properties) return { value: 123 }; // Default wrong type

    for (const [key, prop] of Object.entries(
      schema.properties as Record<string, unknown>,
    )) {
      // Use type guard to safely access prop properties
      if (!isJSONSchemaProperty(prop)) {
        continue; // Skip invalid props
      }

      // Intentionally use wrong types
      switch (prop.type) {
        case "string":
          params[key] = 123; // Number instead of string
          break;
        case "number":
        case "integer":
          params[key] = "not a number"; // String instead of number
          break;
        case "boolean":
          params[key] = "yes"; // String instead of boolean
          break;
        case "array":
          params[key] = "not an array"; // String instead of array
          break;
        case "object":
          params[key] = "not an object"; // String instead of object
          break;
      }
    }

    return params;
  }

  private generateInvalidValueParams(schema: unknown): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    if (!isJSONSchema(schema) || !schema.properties) return { value: null };

    for (const [key, prop] of Object.entries(
      schema.properties as Record<string, unknown>,
    )) {
      // Use type guard to safely access prop properties
      if (!isJSONSchemaProperty(prop)) {
        continue; // Skip invalid props
      }

      if (prop.type === "string") {
        const enumValues = safeGetProperty(prop, "enum", (v): v is string[] => Array.isArray(v));
        const format = safeGetProperty(prop, "format", (v): v is string => typeof v === "string");

        if (enumValues) {
          params[key] = "not_in_enum"; // Value not in enum
        } else if (format === "email") {
          params[key] = "invalid-email"; // Invalid email
        } else if (format === "uri") {
          params[key] = "not://a/valid/uri"; // Invalid URI
        } else {
          params[key] = ""; // Empty string
        }
      } else if (prop.type === "number" || prop.type === "integer") {
        const minimum = safeGetProperty(prop, "minimum", (v): v is number => typeof v === "number");
        const maximum = safeGetProperty(prop, "maximum", (v): v is number => typeof v === "number");

        if (minimum !== undefined) {
          params[key] = minimum - 1; // Below minimum
        } else if (maximum !== undefined) {
          params[key] = maximum + 1; // Above maximum
        } else {
          params[key] = -999999; // Extreme value
        }
      }
    }

    return params;
  }

  private generateParamsWithValue(
    tool: Tool,
    value: unknown,
  ): Record<string, unknown> {
    const schema = this.getToolSchema(tool);
    const params: Record<string, unknown> = {};

    if (isJSONSchema(schema) && schema.properties) {
      // Find first string parameter
      for (const [key, prop] of Object.entries(
        schema.properties as Record<string, unknown>,
      )) {
        // Use type guard to safely access prop properties
        if (isJSONSchemaProperty(prop) && prop.type === "string") {
          params[key] = value;
          break;
        }
      }
    }

    if (Object.keys(params).length === 0) {
      params.value = value; // Default parameter name
    }

    return params;
  }


  private calculateMetrics(
    tests: ErrorTestDetail[],
  ): ErrorHandlingMetrics {

    // Calculate enhanced score with bonus points for quality
    let enhancedScore = 0;
    let maxPossibleScore = 0;

    tests.forEach((test) => {
      maxPossibleScore += 100; // Base score for each test

      if (test.passed) {
        enhancedScore += 100; // Base points for passing

        // Bonus points for error quality
        // Extra points for specific field names in error
        if (
          /\b(query|field|parameter|argument|prop|key)\b/i.test(
            test.actualResponse.errorMessage ?? "",
          )
        ) {
          enhancedScore += 10;
          maxPossibleScore += 10;
        }

        // Extra points for helpful context
        if (
          test.actualResponse.errorMessage &&
          test.actualResponse.errorMessage.length > 30
        ) {
          enhancedScore += 5;
          maxPossibleScore += 5;
        }

        // Extra points for proper error codes
        if (test.actualResponse.errorCode) {
          enhancedScore += 5;
          maxPossibleScore += 5;
        }
      }
    });

    const score =
      maxPossibleScore > 0 ? (enhancedScore / maxPossibleScore) * 100 : 0;

    // Determine quality rating based on enhanced score
    let quality: ErrorHandlingMetrics["errorResponseQuality"];
    if (score >= 85) quality = "excellent";
    else if (score >= 70) quality = "good";
    else if (score >= 50) quality = "fair";
    else quality = "poor";

    // Check for proper error codes and messages
    const hasProperErrorCodes = tests.some(
      (t) => t.actualResponse.errorCode !== undefined,
    );

    const hasDescriptiveMessages = tests.some(
      (t) =>
        t.actualResponse.errorMessage &&
        t.actualResponse.errorMessage.length > 10,
    );

    const validatesInputs = tests
      .filter((t) => ["missing_required", "wrong_type"].includes(t.testType))
      .some((t) => t.passed);

    return {
      mcpComplianceScore: score,
      errorResponseQuality: quality,
      hasProperErrorCodes,
      hasDescriptiveMessages,
      validatesInputs,
      testDetails: tests,
    };
  }

  private determineErrorHandlingStatus(
    metrics: ErrorHandlingMetrics,
  ): AssessmentStatus {
    // More lenient thresholds that recognize good error handling
    if (metrics.mcpComplianceScore >= 70) return "PASS";
    if (metrics.mcpComplianceScore >= 40) return "NEED_MORE_INFO";
    return "FAIL";
  }

  private generateExplanation(
    metrics: ErrorHandlingMetrics,
    tests: ErrorTestDetail[],
  ): string {
    const parts: string[] = [];

    const passedTests = tests.filter((t) => t.passed).length;
    const totalTests = tests.length;

    parts.push(
      `Error handling compliance score: ${metrics.mcpComplianceScore.toFixed(1)}% (${passedTests}/${totalTests} tests passed).`,
    );

    // Count how many types of validation are working
    const validationTypes: string[] = [];
    if (tests.some((t) => t.testType === "missing_required" && t.passed)) {
      validationTypes.push("missing parameter validation");
    }
    if (tests.some((t) => t.testType === "wrong_type" && t.passed)) {
      validationTypes.push("type validation");
    }
    if (tests.some((t) => t.testType === "invalid_values" && t.passed)) {
      validationTypes.push("value validation");
    }
    if (tests.some((t) => t.testType === "excessive_input" && t.passed)) {
      validationTypes.push("input size validation");
    }

    if (validationTypes.length > 0) {
      parts.push(
        `Implements ${validationTypes.length}/4 validation types: ${validationTypes.join(", ")}.`,
      );
    } else {
      parts.push("No input validation detected.");
    }

    parts.push(
      `${metrics.hasDescriptiveMessages ? "Has" : "Missing"} descriptive error messages,`,
      `${metrics.hasProperErrorCodes ? "uses" : "missing"} proper error codes.`,
    );

    // Count tools tested
    const toolsTested = [...new Set(tests.map((t) => t.toolName))].length;
    parts.push(
      `Tested ${toolsTested} tools with ${totalTests} validation scenarios.`,
    );

    return parts.join(" ");
  }

  private generateRecommendations(
    metrics: ErrorHandlingMetrics,
    tests: ErrorTestDetail[],
  ): string[] {
    const recommendations: string[] = [];

    if (!metrics.hasProperErrorCodes) {
      recommendations.push(
        "Implement consistent error codes for different error types",
      );
    }

    if (!metrics.hasDescriptiveMessages) {
      recommendations.push(
        "Provide descriptive error messages that help users understand the issue",
      );
    }

    if (!metrics.validatesInputs) {
      recommendations.push(
        "Implement proper input validation for all parameters",
      );
    }

    const failedTypes = [
      ...new Set(tests.filter((t) => !t.passed).map((t) => t.testType)),
    ];

    if (failedTypes.includes("missing_required")) {
      recommendations.push("Validate and report missing required parameters");
    }

    if (failedTypes.includes("wrong_type")) {
      recommendations.push("Implement type checking for all parameters");
    }

    if (failedTypes.includes("excessive_input")) {
      recommendations.push(
        "Implement input size limits and handle large inputs gracefully",
      );
    }

    return recommendations;
  }
}