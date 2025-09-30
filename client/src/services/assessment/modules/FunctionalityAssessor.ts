/**
 * Functionality Assessor Module
 * Tests tool functionality and basic operations
 */

import {
  FunctionalityAssessment,
  ToolTestResult,
} from "@/lib/assessmentTypes";
import { BaseAssessor } from "./BaseAssessor";
import { AssessmentContext } from "../AssessmentOrchestrator";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { isJSONSchema, isJSONSchemaProperty } from "@/utils/typeGuards";

export class FunctionalityAssessor extends BaseAssessor {
  async assess(context: AssessmentContext): Promise<FunctionalityAssessment> {
    this.log("Starting functionality assessment");

    const toolResults: ToolTestResult[] = [];
    const brokenTools: string[] = [];
    let workingTools = 0;

    for (const tool of context.tools) {
      this.testCount++;

      if (!this.config.autoTest) {
        // Skip actual testing if autoTest is disabled
        toolResults.push({
          toolName: tool.name,
          tested: false,
          status: "untested",
        });
        continue;
      }

      const result = await this.testTool(tool, context.callTool);
      toolResults.push(result);

      if (result.status === "working") {
        workingTools++;
      } else if (result.status === "broken") {
        brokenTools.push(tool.name);

        if (this.config.skipBrokenTools) {
          this.log(`Skipping further tests for broken tool: ${tool.name}`);
        }
      }
    }

    const totalTools = context.tools.length;
    const testedTools = toolResults.filter((r) => r.tested).length;
    const coveragePercentage =
      totalTools > 0 ? (testedTools / totalTools) * 100 : 0;

    const status = this.determineStatus(workingTools, testedTools);
    const explanation = this.generateExplanation(
      totalTools,
      testedTools,
      workingTools,
      brokenTools,
    );

    return {
      totalTools,
      testedTools,
      workingTools,
      brokenTools,
      coveragePercentage,
      status,
      explanation,
      toolResults,
    };
  }

  private async testTool(
    tool: Tool,
    callTool: (name: string, params: Record<string, unknown>) => Promise<unknown>,
  ): Promise<ToolTestResult> {
    const startTime = Date.now();

    try {
      // Generate and validate parameters
      const testParams = this.generateMinimalParams(tool);

      this.log(`🔧 Testing tool: ${tool.name}`);
      this.log(`📋 Generated params: ${JSON.stringify(testParams, null, 2)}`);

      // Log tool schema for debugging
      if (tool.inputSchema) {
        const schema = typeof tool.inputSchema === "string"
          ? this.safeJsonParse(tool.inputSchema)
          : tool.inputSchema;
        this.log(`📊 Tool schema required: ${JSON.stringify((schema as any)?.required || [])}`);
      }

      // Validate parameters against schema
      const validationResult = this.validateParams(testParams, tool.inputSchema);
      if (!validationResult.valid) {
        this.log(`❌ Parameter validation failed for ${tool.name}: ${validationResult.errors.join(", ")}`);
        return {
          toolName: tool.name,
          tested: true,
          status: "broken",
          error: `Parameter validation failed: ${validationResult.errors.join(", ")}`,
          executionTime: Date.now() - startTime,
          testParameters: testParams,
        };
      }

      // Execute with enhanced logging
      this.log(`🚀 Executing tool call for ${tool.name}...`);
      const response = await this.executeWithTimeout(
        callTool(tool.name, testParams),
        this.config.testTimeout,
      );

      const executionTime = Date.now() - startTime;
      this.log(`⏱️ Tool ${tool.name} executed in ${executionTime}ms`);
      this.log(`📤 Tool response for ${tool.name}: ${JSON.stringify(response, null, 2)}`);

      // Enhanced error detection
      const errorInfo = this.analyzeResponse(response);
      if (errorInfo.isError) {
        this.log(`⚠️ Tool ${tool.name} returned error: ${errorInfo.message}`);
        return {
          toolName: tool.name,
          tested: true,
          status: "broken",
          error: errorInfo.message,
          executionTime,
          testParameters: testParams,
          response,
        };
      }

      this.log(`✅ Tool ${tool.name} test successful`);
      return {
        toolName: tool.name,
        tested: true,
        status: "working",
        executionTime,
        testParameters: testParams,
        response,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.log(`💥 Tool test failed for ${tool.name}: ${error instanceof Error ? error.message : String(error)}`);
      return {
        toolName: tool.name,
        tested: true,
        status: "broken",
        error: this.extractErrorMessage(error),
        executionTime,
      };
    }
  }

  private generateMinimalParams(tool: Tool): Record<string, unknown> {
    if (!tool.inputSchema) return {};

    const schema =
      typeof tool.inputSchema === "string"
        ? this.safeJsonParse(tool.inputSchema)
        : tool.inputSchema;

    if (!isJSONSchema(schema) || !schema.properties) return {};

    const params: Record<string, unknown> = {};
    const required = schema.required || [];

    console.log(`🧪 Generating params for ${tool.name}, required: [${required.join(', ')}]`);

    // ALWAYS include required parameters
    for (const requiredKey of required) {
      if (schema.properties[requiredKey] && isJSONSchemaProperty(schema.properties[requiredKey])) {
        params[requiredKey] = this.generateSmartParamValue(
          schema.properties[requiredKey],
          requiredKey,
          tool.name
        );
        console.log(`✅ Required param ${requiredKey}:`, params[requiredKey]);
      }
    }

    // Only include optional parameters if the tool has required parameters
    // Tools with no required parameters likely work without any parameters
    if (required.length > 0) {
      for (const [key, prop] of Object.entries(
        schema.properties as Record<string, unknown>,
      )) {
        if (!required.includes(key) && isJSONSchemaProperty(prop) && this.shouldIncludeOptional(prop, key)) {
          params[key] = this.generateSmartParamValue(prop, key, tool.name);
          console.log(`📝 Optional param ${key}:`, params[key]);
        }
      }
    } else {
      console.log(`🚫 Skipping optional params for ${tool.name} - no required params suggests tool works without parameters`);
    }

    console.log(`🎯 Final params for ${tool.name}:`, params);
    return params;
  }

  private generateSmartParamValue(prop: any, paramName: string, toolName: string): unknown {
    const type = prop.type;

    switch (type) {
      case "string":
        if (prop.enum) return prop.enum[0];
        if (prop.format === "uri") return "https://example.com";
        if (prop.format === "email") return "test@example.com";

        // Context-aware defaults based on parameter name
        const lowerParam = paramName.toLowerCase();
        if (lowerParam.includes("path") || lowerParam.includes("file")) return "/tmp/test.txt";
        if (lowerParam.includes("query") || lowerParam.includes("search")) return "test query";
        if (lowerParam.includes("name")) return "test_name";
        if (lowerParam.includes("id")) return "test_id_123";
        if (lowerParam.includes("collection")) return "test_collection";
        if (lowerParam.includes("text") || lowerParam.includes("content") || lowerParam.includes("information")) return "This is test content for MCP assessment";
        if (lowerParam.includes("url")) return "https://example.com";
        if (lowerParam.includes("description")) return "Test description";

        // Respect string constraints
        const minLength = prop.minLength || 1;
        return prop.minLength ? "test_".repeat(Math.ceil(minLength / 5)).substring(0, minLength) : "test";

      case "number":
      case "integer":
        if (prop.minimum !== undefined) return prop.minimum;
        if (prop.maximum !== undefined) return Math.min(prop.maximum, 10);
        return prop.default !== undefined ? prop.default : 1; // Use 1 instead of 0

      case "boolean":
        return prop.default !== undefined ? prop.default : true; // Default to true for better testing

      case "array":
        // Generate non-empty array for better testing
        if (prop.items && prop.items.type) {
          const itemValue = this.generateSmartParamValue(prop.items, `${paramName}_item`, toolName);
          return prop.minItems > 0 ? Array(prop.minItems).fill(itemValue) : [itemValue];
        }
        return prop.minItems > 0 ? Array(prop.minItems).fill("test") : ["test"];

      case "object":
        // Generate minimal object structure if properties defined
        if (prop.properties) {
          const obj: Record<string, unknown> = {};
          const objRequired = prop.required || [];

          for (const reqKey of objRequired) {
            if (prop.properties[reqKey]) {
              obj[reqKey] = this.generateSmartParamValue(
                prop.properties[reqKey],
                reqKey,
                toolName
              );
            }
          }
          return obj;
        }
        return { test: "value" }; // Non-empty object

      default:
        return prop.default !== undefined ? prop.default : null;
    }
  }

  private shouldIncludeOptional(prop: any, paramName: string): boolean {
    // Include optional parameters that are commonly important
    const lowerParam = paramName.toLowerCase();
    const importantParams = [
      "collection", "metadata", "options", "config", "settings",
      "format", "type", "mode", "timeout", "limit", "offset"
    ];

    // Include if it's an important parameter name
    if (importantParams.some(important => lowerParam.includes(important))) {
      return true;
    }

    // Include if it has a default value (likely important)
    if (prop.default !== undefined) {
      return true;
    }

    // Include if it's an enum (limited options, probably important)
    if (prop.enum) {
      return true;
    }

    // Skip other optional parameters to keep tests minimal
    return false;
  }

  private validateParams(params: Record<string, unknown>, inputSchema: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!inputSchema) {
      return { valid: true, errors: [] }; // No schema to validate against
    }

    const schema = typeof inputSchema === "string" ? this.safeJsonParse(inputSchema) : inputSchema;

    if (!schema || !schema.properties) {
      return { valid: true, errors: [] };
    }

    const required = schema.required || [];

    // If tool has no required parameters and we generated no parameters, it's valid
    if (required.length === 0 && Object.keys(params).length === 0) {
      return { valid: true, errors: [] };
    }

    // Check required parameters only if there are any
    for (const requiredParam of required) {
      if (!(requiredParam in params)) {
        errors.push(`Missing required parameter: ${requiredParam}`);
      }
    }

    // Basic type validation - only validate parameters we actually generated
    for (const [key, value] of Object.entries(params)) {
      const propSchema = schema.properties[key];
      if (propSchema && propSchema.type) {
        const expectedType = propSchema.type;
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (expectedType !== actualType) {
          // Allow some type flexibility
          if (!(expectedType === 'integer' && actualType === 'number')) {
            errors.push(`Parameter ${key} should be ${expectedType}, got ${actualType}`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private analyzeResponse(response: unknown): { isError: boolean; message: string } {
    if (!response) {
      return { isError: true, message: "No response received" };
    }

    // Check various error patterns
    if (typeof response === 'object' && response !== null) {
      const obj = response as any;

      // Direct error indicators
      if (obj.isError === true) {
        return { isError: true, message: obj.error || obj.message || "Error response" };
      }

      if (obj.error) {
        return { isError: true, message: typeof obj.error === 'string' ? obj.error : JSON.stringify(obj.error) };
      }

      // Check result object for errors
      if (obj.result && typeof obj.result === 'object') {
        if (obj.result.error || obj.result.isError) {
          return { isError: true, message: obj.result.error || obj.result.message || "Error in result" };
        }
      }

      // Check content array for error types
      if (Array.isArray(obj.content)) {
        for (const content of obj.content) {
          if (content && typeof content === 'object') {
            if (content.type === 'error' || content.error || content.isError) {
              return { isError: true, message: content.text || content.error || content.message || "Error in content" };
            }
            // Check for error indicators in text content
            if (content.type === 'text' && typeof content.text === 'string') {
              const text = content.text.toLowerCase();
              if (text.includes('error') || text.includes('failed') || text.includes('invalid') || text.includes('unknown tool')) {
                return { isError: true, message: content.text };
              }
            }
          }
        }
      }

      // Check for HTTP error status codes
      if (obj.status && typeof obj.status === 'number' && obj.status >= 400) {
        return { isError: true, message: `HTTP ${obj.status}: ${obj.statusText || 'Error'}` };
      }
    }

    // String responses that indicate errors
    if (typeof response === 'string') {
      const lowerResponse = response.toLowerCase();
      if (lowerResponse.includes('error') || lowerResponse.includes('failed') || lowerResponse.includes('invalid')) {
        return { isError: true, message: response };
      }
    }

    return { isError: false, message: "" };
  }

  protected extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (typeof error === 'object' && error !== null) {
      const obj = error as any;
      return obj.message || obj.error || JSON.stringify(error);
    }

    return "Unknown error";
  }

  private generateExplanation(
    total: number,
    tested: number,
    working: number,
    broken: string[],
  ): string {
    const parts: string[] = [];

    if (total === 0) {
      return "No tools available to test.";
    }

    parts.push(`Tested ${tested} out of ${total} tools.`);

    if (tested > 0) {
      const successRate = (working / tested) * 100;
      parts.push(
        `${working} tools working correctly (${successRate.toFixed(1)}% success rate).`,
      );
    }

    if (broken.length > 0) {
      if (broken.length <= 3) {
        parts.push(`Broken tools: ${broken.join(", ")}.`);
      } else {
        parts.push(`${broken.length} tools failed testing.`);
      }
    }

    return parts.join(" ");
  }
}
