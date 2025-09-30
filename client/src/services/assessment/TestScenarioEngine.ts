/**
 * Test Scenario Engine for Multi-Scenario MCP Tool Testing
 * Orchestrates comprehensive testing with multiple scenarios per tool
 */

import {
  Tool,
  CompatibilityCallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { TestDataGenerator, TestScenario } from "./TestDataGenerator";
import { isJSONSchemaProperty, safeGetProperty } from "@/utils/typeGuards";
import {
  ResponseValidator,
  ValidationResult,
  ValidationContext,
} from "./ResponseValidator";

export interface ScenarioTestResult {
  scenario: TestScenario;
  executed: boolean;
  executionTime: number;
  response?: CompatibilityCallToolResult;
  error?: string;
  validation: ValidationResult;
}

export interface ComprehensiveToolTestResult {
  toolName: string;
  tested: boolean;
  totalScenarios: number;
  scenariosExecuted: number;
  scenariosPassed: number;
  scenariosFailed: number;
  overallStatus:
    | "fully_working"
    | "partially_working"
    | "connectivity_only"
    | "broken"
    | "untested";
  confidence: number; // 0-100
  executionTime: number;
  scenarioResults: ScenarioTestResult[];
  summary: {
    happyPathSuccess: boolean;
    edgeCasesHandled: number;
    edgeCasesTotal: number;
    boundariesRespected: number;
    boundariesTotal: number;
    errorHandlingWorks: boolean;
  };
  // NEW: Progressive complexity analysis
  progressiveComplexity?: {
    minimalWorks: boolean;
    simpleWorks: boolean;
    typicalWorks: boolean;
    complexWorks: boolean;
    failurePoint?: "minimal" | "simple" | "typical" | "complex" | "none";
  };
  recommendations: string[];
}

export class TestScenarioEngine {
  private testTimeout: number;

  constructor(testTimeout: number = 5000) {
    this.testTimeout = testTimeout;
  }

  /**
   * Test tool with progressive complexity to identify failure points
   */
  async testProgressiveComplexity(
    tool: Tool,
    callTool: (
      name: string,
      params: Record<string, unknown>,
    ) => Promise<CompatibilityCallToolResult>,
  ): Promise<ComprehensiveToolTestResult["progressiveComplexity"]> {
    const result: ComprehensiveToolTestResult["progressiveComplexity"] = {
      minimalWorks: false,
      simpleWorks: false,
      typicalWorks: false,
      complexWorks: false,
      failurePoint: undefined,
    };

    // Test 1: Minimal complexity - absolute minimum params
    const minimalParams = this.generateMinimalParams(tool);
    try {
      const minimalResult = await Promise.race([
        callTool(tool.name, minimalParams),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), this.testTimeout),
        ),
      ]);
      result.minimalWorks = !minimalResult.isError;
    } catch {
      result.minimalWorks = false;
      result.failurePoint = "minimal";
      return result; // Stop if minimal fails
    }

    // Test 2: Simple complexity - one required param with simple value
    const simpleParams = this.generateSimpleParams(tool);
    try {
      const simpleResult = await Promise.race([
        callTool(tool.name, simpleParams),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), this.testTimeout),
        ),
      ]);
      result.simpleWorks = !simpleResult.isError;
    } catch {
      result.simpleWorks = false;
      result.failurePoint = "simple";
      return result;
    }

    // Test 3: Typical complexity - realistic normal usage
    const typicalParams = TestDataGenerator.generateRealisticParams(
      tool,
      "typical",
    );
    try {
      const typicalResult = await Promise.race([
        callTool(tool.name, typicalParams),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), this.testTimeout),
        ),
      ]);
      result.typicalWorks = !typicalResult.isError;
    } catch {
      result.typicalWorks = false;
      result.failurePoint = "typical";
      return result;
    }

    // Test 4: Complex - all params with nested structures
    const complexParams = TestDataGenerator.generateRealisticParams(
      tool,
      "maximum",
    );
    try {
      const complexResult = await Promise.race([
        callTool(tool.name, complexParams),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), this.testTimeout),
        ),
      ]);
      result.complexWorks = !complexResult.isError;
      if (!result.complexWorks) {
        result.failurePoint = "complex";
      } else {
        result.failurePoint = "none"; // Everything works!
      }
    } catch {
      result.complexWorks = false;
      result.failurePoint = "complex";
    }

    return result;
  }

  /**
   * Generate minimal parameters (only absolutely required fields)
   */
  private generateMinimalParams(tool: Tool): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    if (!tool.inputSchema || tool.inputSchema.type !== "object") {
      return params;
    }

    // Only include required fields with minimal values
    if (tool.inputSchema.required && tool.inputSchema.properties) {
      for (const requiredField of tool.inputSchema.required) {
        const schema = tool.inputSchema.properties[requiredField];
        if (schema) {
          params[requiredField] = this.generateMinimalValue(schema as any);
        }
      }
    }

    return params;
  }

  /**
   * Generate simple parameters (required fields with simple values)
   */
  private generateSimpleParams(tool: Tool): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    if (!tool.inputSchema || tool.inputSchema.type !== "object") {
      return params;
    }

    // Include required fields with simple realistic values
    if (tool.inputSchema.required && tool.inputSchema.properties) {
      for (const requiredField of tool.inputSchema.required) {
        const schema = tool.inputSchema.properties[requiredField];
        if (schema) {
          params[requiredField] = TestDataGenerator.generateSingleValue(
            requiredField,
            schema as any,
          );
        }
      }
    }

    return params;
  }

  /**
   * Generate minimal value for a schema
   */
  private generateMinimalValue(schema: unknown): unknown {
    // Use type guard to safely access schema properties
    if (!isJSONSchemaProperty(schema)) {
      return null; // Return null for invalid schema
    }

    switch (schema.type) {
      case "string":
        const enumValues = safeGetProperty(schema, "enum", (v): v is string[] => Array.isArray(v));
        return enumValues ? enumValues[0] : "test";
      case "number":
      case "integer":
        const minimum = safeGetProperty(schema, "minimum", (v): v is number => typeof v === "number");
        return minimum ?? 1;
      case "boolean":
        return true;
      case "array":
        return [];
      case "object":
        return {};
      default:
        return null;
    }
  }

  /**
   * Run comprehensive testing for a tool with multiple scenarios
   */
  async testToolComprehensively(
    tool: Tool,
    callTool: (
      name: string,
      params: Record<string, unknown>,
    ) => Promise<CompatibilityCallToolResult>,
  ): Promise<ComprehensiveToolTestResult> {
    const startTime = Date.now();

    // First, run progressive complexity testing
    const progressiveComplexity = await this.testProgressiveComplexity(
      tool,
      callTool,
    );

    // Generate test scenarios
    let scenarios: TestScenario[] = [];
    try {
      scenarios = TestDataGenerator.generateTestScenarios(tool);
      console.log(`Generated ${scenarios.length} scenarios for tool ${tool.name}:`, scenarios.map(s => s.name));
    } catch (error) {
      console.error(`Failed to generate scenarios for tool ${tool.name}:`, error);
      // Create a minimal fallback scenario if generation fails
      scenarios = [{
        name: "Basic Connectivity Test",
        description: "Minimal test to check if tool responds",
        params: {},
        expectedBehavior: "Should return any response",
        category: "happy_path",
      }];
    }

    // Initialize result
    const result: ComprehensiveToolTestResult = {
      toolName: tool.name,
      tested: true,
      totalScenarios: scenarios.length,
      scenariosExecuted: 0,
      scenariosPassed: 0,
      scenariosFailed: 0,
      overallStatus: "untested",
      confidence: 0,
      executionTime: 0,
      scenarioResults: [],
      summary: {
        happyPathSuccess: false,
        edgeCasesHandled: 0,
        edgeCasesTotal: 0,
        boundariesRespected: 0,
        boundariesTotal: 0,
        errorHandlingWorks: false,
      },
      progressiveComplexity, // Add progressive complexity analysis
      recommendations: [],
    };

    // Execute each scenario
    for (const scenario of scenarios) {
      console.log(`Executing scenario '${scenario.name}' for tool ${tool.name}`);
      try {
        const scenarioResult = await this.executeScenario(
          tool,
          scenario,
          callTool,
        );
        result.scenarioResults.push(scenarioResult);
        console.log(`Scenario '${scenario.name}' completed:`, {
          executed: scenarioResult.executed,
          isValid: scenarioResult.validation.isValid,
          classification: scenarioResult.validation.classification
        });
      } catch (error) {
        console.error(`Failed to execute scenario '${scenario.name}':`, error);
        // Add a failed scenario result
        result.scenarioResults.push({
          scenario,
          executed: false,
          executionTime: 0,
          error: error instanceof Error ? error.message : String(error),
          validation: {
            isValid: false,
            isError: true,
            confidence: 0,
            issues: [`Scenario execution failed: ${error}`],
            evidence: [],
            classification: "error",
          },
        });
      }

      const lastResult = result.scenarioResults[result.scenarioResults.length - 1];
      if (lastResult?.executed) {
        result.scenariosExecuted++;

        // Update counters based on validation
        if (lastResult.validation.isValid) {
          result.scenariosPassed++;

          // Update summary based on category
          switch (scenario.category) {
            case "happy_path":
              result.summary.happyPathSuccess = true;
              break;
            case "edge_case":
              result.summary.edgeCasesHandled++;
              break;
            case "boundary":
              result.summary.boundariesRespected++;
              break;
            case "error_case":
              result.summary.errorHandlingWorks = true;
              break;
          }
        } else {
          result.scenariosFailed++;
        }

        // Count totals for categories
        switch (scenario.category) {
          case "edge_case":
            result.summary.edgeCasesTotal++;
            break;
          case "boundary":
            result.summary.boundariesTotal++;
            break;
        }
      }
    }

    // Calculate overall status and confidence
    result.executionTime = Date.now() - startTime;
    result.overallStatus = this.determineOverallStatus(result);
    result.confidence = this.calculateConfidence(result);
    result.recommendations = this.generateRecommendations(result);

    return result;
  }

  /**
   * Execute a single test scenario
   */
  private async executeScenario(
    tool: Tool,
    scenario: TestScenario,
    callTool: (
      name: string,
      params: Record<string, unknown>,
    ) => Promise<CompatibilityCallToolResult>,
  ): Promise<ScenarioTestResult> {
    const startTime = Date.now();

    try {
      // Call tool with timeout
      const response = await Promise.race([
        callTool(tool.name, scenario.params),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), this.testTimeout),
        ),
      ]);

      // Validate response
      const validationContext: ValidationContext = {
        tool,
        input: scenario.params,
        response,
        scenarioCategory: scenario.category,
      };

      const validation = ResponseValidator.validateResponse(validationContext);

      return {
        scenario,
        executed: true,
        executionTime: Date.now() - startTime,
        response,
        validation,
      };
    } catch (error) {
      // Handle execution errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Create error validation result
      const validation: ValidationResult = {
        isValid: false,
        isError: true,
        confidence: 0,
        issues: [`Execution error: ${errorMessage}`],
        evidence: [],
        classification: "broken",
      };

      // For error scenarios, exceptions might be expected
      if (
        scenario.category === "error_case" &&
        !errorMessage.includes("Timeout")
      ) {
        validation.isValid = true;
        validation.confidence = 80;
        validation.classification = "partially_working";
        validation.evidence.push(
          "Tool properly rejected invalid input with exception",
        );
      }

      return {
        scenario,
        executed: true,
        executionTime: Date.now() - startTime,
        error: errorMessage,
        validation,
      };
    }
  }

  /**
   * Determine overall status based on scenario results
   */
  private determineOverallStatus(
    result: ComprehensiveToolTestResult,
  ): ComprehensiveToolTestResult["overallStatus"] {
    // If no scenarios executed, it's untested
    if (result.scenariosExecuted === 0) {
      return "untested";
    }

    // If any scenarios executed successfully (even if they failed validation),
    // the tool has basic connectivity
    const anyExecuted = result.scenarioResults.some(sr => sr.executed && !sr.error);
    if (!anyExecuted) {
      return "broken"; // Only mark as broken if nothing could execute
    }

    // Check how many "failures" are actually business logic validation (tool working correctly)
    const businessLogicSuccesses = result.scenarioResults.filter(
      (sr) =>
        sr.validation.classification === "fully_working" &&
        sr.validation.evidence.some((e) => e.includes("business logic")),
    ).length;

    // Adjust pass rate to include business logic validation as successes
    const actualPasses = result.scenariosPassed + businessLogicSuccesses;
    const adjustedPassRate = Math.min(
      1,
      actualPasses / result.scenariosExecuted,
    );

    // Check critical scenarios
    const happyPathResult = result.scenarioResults.find(
      (sr) => sr.scenario.category === "happy_path",
    );
    const happyPathWorks =
      result.summary.happyPathSuccess ||
      happyPathResult?.validation.classification === "fully_working";

    // Determine status based on adjusted metrics - more realistic thresholds
    // If happy path works, the tool is fundamentally functional
    if (happyPathWorks) {
      if (adjustedPassRate >= 0.6) {
        return "fully_working";
      } else if (adjustedPassRate >= 0.3) {
        return "partially_working";
      } else {
        return "connectivity_only";
      }
    }

    // Even without perfect happy path, if we have good business logic validation
    if (businessLogicSuccesses > 0 && adjustedPassRate >= 0.3) {
      return "partially_working";
    }

    // Traditional thresholds but more lenient
    if (adjustedPassRate >= 0.5) {
      return "fully_working";
    } else if (adjustedPassRate >= 0.2) {
      return "partially_working";
    } else if (adjustedPassRate >= 0.1) {
      return "connectivity_only";
    } else {
      // Final fallback: if tool executed any scenarios, it has connectivity
      return result.scenariosExecuted > 0 ? "connectivity_only" : "broken";
    }
  }

  /**
   * Calculate confidence score based on test coverage and results
   */
  private calculateConfidence(result: ComprehensiveToolTestResult): number {
    // Handle edge case where no scenarios were generated
    if (result.totalScenarios === 0) {
      return 10; // Very low confidence if no scenarios could be generated
    }

    // Start with higher base confidence if tool executed any scenarios
    const executionRate = result.scenariosExecuted / result.totalScenarios;
    let confidence = Math.max(50, executionRate * 100); // Minimum 50% if any scenarios ran

    // Check for business logic successes
    const businessLogicSuccesses = result.scenarioResults.filter(
      (sr) =>
        sr.validation.classification === "fully_working" &&
        sr.validation.evidence.some((e) => e.includes("business logic")),
    ).length;

    // If happy path works, boost confidence significantly
    if (result.summary.happyPathSuccess) {
      confidence = Math.max(confidence, 75); // At least 75% if happy path works
    }

    // Adjust based on pass rate, but less harshly
    const passRate =
      result.scenariosExecuted > 0
        ? result.scenariosPassed / result.scenariosExecuted
        : 0;

    // Use square root to make the penalty less severe
    confidence *= Math.max(0.5, Math.sqrt(passRate)); // Minimum 50% multiplier

    // Bonus for critical scenarios
    if (result.summary.happyPathSuccess) {
      confidence = Math.min(100, confidence + 15);
    }
    if (result.summary.errorHandlingWorks) {
      confidence = Math.min(100, confidence + 10);
    }
    if (businessLogicSuccesses > 0) {
      confidence = Math.min(100, confidence + 10);
    }

    // Reduced penalty for low test coverage
    if (result.scenariosExecuted < 3) {
      confidence *= 0.85; // Less harsh penalty
    }

    // Consider validation confidence from individual scenarios
    if (result.scenarioResults.length > 0) {
      const avgValidationConfidence =
        result.scenarioResults
          .map((sr) => sr.validation.confidence)
          .reduce((a, b) => a + b, 0) / result.scenarioResults.length;

      // Weighted average with execution confidence - favor execution confidence more
      confidence = confidence * 0.7 + avgValidationConfidence * 0.3;
    }

    // Ensure minimum confidence for working tools
    if (result.summary.happyPathSuccess || businessLogicSuccesses > 0) {
      confidence = Math.max(confidence, 60);
    }

    // Final safety check for valid confidence values
    const finalConfidence = Math.round(Math.min(100, Math.max(0, confidence)));
    return isNaN(finalConfidence) ? 10 : finalConfidence;
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(
    result: ComprehensiveToolTestResult,
  ): string[] {
    const recommendations: string[] = [];

    // Add progressive complexity insights
    if (result.progressiveComplexity) {
      const pc = result.progressiveComplexity;
      if (pc.failurePoint) {
        switch (pc.failurePoint) {
          case "minimal":
            recommendations.push(
              "⚠️ Tool fails with minimal parameters - check basic connectivity and required field handling",
            );
            break;
          case "simple":
            recommendations.push(
              "Tool works with minimal params but fails with simple realistic data",
            );
            recommendations.push(
              "Check parameter validation and type handling",
            );
            break;
          case "typical":
            recommendations.push(
              "Tool handles simple cases but fails with typical usage patterns",
            );
            recommendations.push(
              "Review handling of common parameter combinations",
            );
            break;
          case "complex":
            recommendations.push(
              "Tool works for most cases but struggles with complex/nested data",
            );
            recommendations.push(
              "Consider simplifying complex parameter handling or documenting limitations",
            );
            break;
        }
      } else if (pc.failurePoint === "none") {
        recommendations.push(
          "✅ Tool handles all complexity levels successfully",
        );
      }
    }

    // Check if most failures are business logic errors
    const businessErrorCount = result.scenarioResults.filter(
      (sr) =>
        sr.validation.classification === "fully_working" &&
        sr.validation.evidence.some((e) => e.includes("business logic")),
    ).length;

    if (businessErrorCount > result.scenariosFailed * 0.7) {
      // Most failures are actually business logic validation - tool is working!
      recommendations.push(
        "✅ Tool properly validates business logic and rejects invalid resources",
      );
      recommendations.push(
        "Note: Test failures are due to synthetic test data, not tool malfunction",
      );
      return recommendations;
    }

    // Check happy path
    if (!result.summary.happyPathSuccess) {
      // Check if happy path failed due to business logic
      const happyPathResult = result.scenarioResults.find(
        (sr) => sr.scenario.category === "happy_path",
      );
      if (happyPathResult?.validation.classification === "fully_working") {
        recommendations.push(
          "Tool works correctly but requires valid resource IDs (test data uses synthetic IDs)",
        );
      } else {
        recommendations.push(
          "Fix basic functionality - happy path scenario is failing",
        );
      }
    }

    // Check error handling
    if (!result.summary.errorHandlingWorks) {
      recommendations.push(
        "Improve error handling - tool doesn't properly validate inputs",
      );
    }

    // Check edge cases
    if (
      result.summary.edgeCasesTotal > 0 &&
      result.summary.edgeCasesHandled < result.summary.edgeCasesTotal
    ) {
      const failedEdgeCases =
        result.summary.edgeCasesTotal - result.summary.edgeCasesHandled;
      // Check if edge case failures are business logic errors
      const edgeCaseBusinessErrors = result.scenarioResults.filter(
        (sr) =>
          sr.scenario.category === "edge_case" &&
          sr.validation.classification === "fully_working",
      ).length;

      if (edgeCaseBusinessErrors > 0) {
        recommendations.push(
          `Edge cases properly validate business rules (${edgeCaseBusinessErrors} validation checks working)`,
        );
      } else {
        recommendations.push(
          `Handle edge cases better - ${failedEdgeCases} edge case(s) failed`,
        );
      }
    }

    // Check boundaries
    if (
      result.summary.boundariesTotal > 0 &&
      result.summary.boundariesRespected < result.summary.boundariesTotal
    ) {
      const failedBoundaries =
        result.summary.boundariesTotal - result.summary.boundariesRespected;
      recommendations.push(
        `Respect schema boundaries - ${failedBoundaries} boundary test(s) failed`,
      );
    }

    // Analyze specific validation issues
    const allIssues = new Set<string>();
    const allEvidence = new Set<string>();

    for (const scenarioResult of result.scenarioResults) {
      scenarioResult.validation.issues.forEach((issue) => allIssues.add(issue));
      scenarioResult.validation.evidence.forEach((evidence) =>
        allEvidence.add(evidence),
      );
    }

    // Add specific recommendations based on common issues
    if (allIssues.has("Response appears to just echo input")) {
      recommendations.push(
        "Implement actual functionality - tool is just echoing inputs",
      );
    }

    if (allIssues.has("Response content is too short to be meaningful")) {
      recommendations.push(
        "Return more substantial responses with actual data",
      );
    }

    if (allIssues.has("Response doesn't demonstrate clear functionality")) {
      recommendations.push(
        "Ensure responses clearly demonstrate the tool's intended purpose",
      );
    }

    // Add positive feedback if appropriate
    if (result.overallStatus === "fully_working") {
      recommendations.push(
        "✅ Tool is working well! Consider adding more advanced features.",
      );
    } else if (result.overallStatus === "partially_working") {
      recommendations.push(
        "Tool has basic functionality but needs improvements in edge cases and error handling",
      );
    }

    return recommendations;
  }

  /**
   * Generate a detailed report for a tool test
   */
  static generateDetailedReport(result: ComprehensiveToolTestResult): string {
    const lines: string[] = [
      `## Tool: ${result.toolName}`,
      ``,
      `### Overall Assessment`,
      `- **Status**: ${result.overallStatus}`,
      `- **Confidence**: ${result.confidence}%`,
      `- **Scenarios**: ${result.scenariosPassed}/${result.scenariosExecuted} passed (${result.totalScenarios} total)`,
      `- **Execution Time**: ${result.executionTime}ms`,
      ``,
      `### Summary`,
      `- Happy Path: ${result.summary.happyPathSuccess ? "✅ Working" : "❌ Failed"}`,
      `- Edge Cases: ${result.summary.edgeCasesHandled}/${result.summary.edgeCasesTotal} handled`,
      `- Boundaries: ${result.summary.boundariesRespected}/${result.summary.boundariesTotal} respected`,
      `- Error Handling: ${result.summary.errorHandlingWorks ? "✅ Working" : "❌ Failed"}`,
      ``,
    ];

    if (result.recommendations.length > 0) {
      lines.push(`### Recommendations`);
      result.recommendations.forEach((rec) => {
        lines.push(`- ${rec}`);
      });
      lines.push(``);
    }

    // Add scenario details
    lines.push(`### Scenario Details`);
    for (const scenarioResult of result.scenarioResults) {
      const status = scenarioResult.validation.isValid ? "✅" : "❌";
      lines.push(`- **${scenarioResult.scenario.name}** ${status}`);
      lines.push(`  - Category: ${scenarioResult.scenario.category}`);
      lines.push(`  - Confidence: ${scenarioResult.validation.confidence}%`);
      lines.push(
        `  - Classification: ${scenarioResult.validation.classification}`,
      );

      if (scenarioResult.validation.issues.length > 0) {
        lines.push(`  - Issues:`);
        scenarioResult.validation.issues.forEach((issue) => {
          lines.push(`    - ${issue}`);
        });
      }

      if (scenarioResult.validation.evidence.length > 0) {
        lines.push(`  - Evidence:`);
        scenarioResult.validation.evidence.forEach((evidence) => {
          lines.push(`    - ${evidence}`);
        });
      }
    }

    return lines.join("\n");
  }
}
