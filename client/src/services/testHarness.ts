/**
 * Automated Test Harness for MCP Tools
 * Runs comprehensive test suites including fuzzing, boundary testing, and validation
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { JsonSchemaType } from "../utils/jsonUtils";
import { generateToolTestSuite } from "../utils/testDataGenerator";

/**
 * Test result for a single test case
 */
export interface TestCaseResult {
  testId: string;
  testName: string;
  category:
    | "valid"
    | "missing_required"
    | "wrong_type"
    | "edge_case"
    | "boundary"
    | "fuzzing";
  input: Record<string, unknown>;
  passed: boolean;
  expectedOutcome: "success" | "error";
  actualOutcome: "success" | "error";
  response?: CompatibilityCallToolResult;
  error?: string;
  duration: number;
  timestamp: Date;
}

/**
 * Test suite results for a single tool
 */
export interface ToolTestResults {
  toolName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  successRate: number;
  duration: number;
  testCases: TestCaseResult[];
  summary: {
    validCases: { passed: number; total: number };
    missingRequired: { passed: number; total: number };
    wrongTypes: { passed: number; total: number };
    edgeCases: { passed: number; total: number };
    boundaries: { passed: number; total: number };
    fuzzing: { passed: number; total: number };
  };
  recommendations: string[];
}

/**
 * Test harness configuration
 */
export interface TestHarnessConfig {
  timeout: number; // milliseconds per test
  stopOnFirstFailure: boolean;
  parallelExecution: boolean;
  maxParallel: number;
  includeValidTests: boolean;
  includeMissingRequiredTests: boolean;
  includeWrongTypeTests: boolean;
  includeEdgeCaseTests: boolean;
  includeBoundaryTests: boolean;
  includeFuzzingTests: boolean;
  verboseLogging: boolean;
}

const DEFAULT_CONFIG: TestHarnessConfig = {
  timeout: 5000,
  stopOnFirstFailure: false,
  parallelExecution: false,
  maxParallel: 3,
  includeValidTests: true,
  includeMissingRequiredTests: true,
  includeWrongTypeTests: true,
  includeEdgeCaseTests: true,
  includeBoundaryTests: true,
  includeFuzzingTests: true,
  verboseLogging: false,
};

/**
 * Test harness for automated tool testing
 */
export class TestHarness {
  private config: TestHarnessConfig;
  private testIdCounter = 0;

  constructor(config: Partial<TestHarnessConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Run comprehensive test suite for a single tool
   */
  async runToolTests(
    tool: Tool,
    callTool: (
      name: string,
      params: Record<string, unknown>,
    ) => Promise<CompatibilityCallToolResult>,
  ): Promise<ToolTestResults> {
    const startTime = Date.now();
    const properties = (tool.inputSchema?.properties || {}) as Record<
      string,
      JsonSchemaType
    >;
    const required = tool.inputSchema?.required || [];

    // Generate test suite
    const suite = generateToolTestSuite(properties, required);

    // Collect all test cases
    const allTests: Array<{
      category: TestCaseResult["category"];
      input: Record<string, unknown>;
      expectedOutcome: "success" | "error";
    }> = [];

    if (this.config.includeValidTests) {
      suite.valid.forEach((input) =>
        allTests.push({ category: "valid", input, expectedOutcome: "success" }),
      );
    }

    if (this.config.includeMissingRequiredTests) {
      suite.missingRequired.forEach((input) =>
        allTests.push({
          category: "missing_required",
          input,
          expectedOutcome: "error",
        }),
      );
    }

    if (this.config.includeWrongTypeTests) {
      suite.wrongTypes.forEach((input) =>
        allTests.push({
          category: "wrong_type",
          input,
          expectedOutcome: "error",
        }),
      );
    }

    if (this.config.includeEdgeCaseTests) {
      suite.edgeCases.forEach((input) =>
        allTests.push({
          category: "edge_case",
          input,
          expectedOutcome: "success",
        }),
      );
    }

    if (this.config.includeBoundaryTests) {
      suite.boundaries.forEach((input) =>
        allTests.push({
          category: "boundary",
          input,
          expectedOutcome: "success",
        }),
      );
    }

    if (this.config.includeFuzzingTests) {
      suite.fuzzing.forEach((input) =>
        allTests.push({ category: "fuzzing", input, expectedOutcome: "error" }),
      );
    }

    // Execute tests
    const results: TestCaseResult[] = [];

    if (this.config.parallelExecution) {
      // Parallel execution
      const batches = this.chunkArray(allTests, this.config.maxParallel);
      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map((test) => this.executeTest(tool.name, test, callTool)),
        );
        results.push(...batchResults);

        if (
          this.config.stopOnFirstFailure &&
          batchResults.some((r) => !r.passed)
        ) {
          break;
        }
      }
    } else {
      // Sequential execution
      for (const test of allTests) {
        const result = await this.executeTest(tool.name, test, callTool);
        results.push(result);

        if (this.config.stopOnFirstFailure && !result.passed) {
          break;
        }
      }
    }

    const duration = Date.now() - startTime;

    // Analyze results
    return this.analyzeResults(tool.name, results, duration);
  }

  /**
   * Execute a single test case
   */
  private async executeTest(
    toolName: string,
    test: {
      category: TestCaseResult["category"];
      input: Record<string, unknown>;
      expectedOutcome: "success" | "error";
    },
    callTool: (
      name: string,
      params: Record<string, unknown>,
    ) => Promise<CompatibilityCallToolResult>,
  ): Promise<TestCaseResult> {
    const testId = `test-${++this.testIdCounter}`;
    const testName = this.getTestName(test.category, test.input);
    const startTime = Date.now();

    if (this.config.verboseLogging) {
      console.log(`[TestHarness] Running ${testId}: ${testName}`);
    }

    try {
      // Execute tool with timeout
      const response = await this.withTimeout(
        callTool(toolName, test.input),
        this.config.timeout,
      );

      const duration = Date.now() - startTime;
      const actualOutcome = response.isError ? "error" : "success";
      const passed = actualOutcome === test.expectedOutcome;

      return {
        testId,
        testName,
        category: test.category,
        input: test.input,
        passed,
        expectedOutcome: test.expectedOutcome,
        actualOutcome,
        response,
        duration,
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const actualOutcome = "error";
      const passed = actualOutcome === test.expectedOutcome;

      return {
        testId,
        testName,
        category: test.category,
        input: test.input,
        passed,
        expectedOutcome: test.expectedOutcome,
        actualOutcome,
        error: error instanceof Error ? error.message : String(error),
        duration,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Analyze test results and generate summary
   */
  private analyzeResults(
    toolName: string,
    results: TestCaseResult[],
    duration: number,
  ): ToolTestResults {
    const totalTests = results.length;
    const passedTests = results.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;
    const successRate = totalTests > 0 ? passedTests / totalTests : 0;

    // Categorize results
    const byCategory = {
      valid: results.filter((r) => r.category === "valid"),
      missingRequired: results.filter((r) => r.category === "missing_required"),
      wrongTypes: results.filter((r) => r.category === "wrong_type"),
      edgeCases: results.filter((r) => r.category === "edge_case"),
      boundaries: results.filter((r) => r.category === "boundary"),
      fuzzing: results.filter((r) => r.category === "fuzzing"),
    };

    const summary = {
      validCases: {
        passed: byCategory.valid.filter((r) => r.passed).length,
        total: byCategory.valid.length,
      },
      missingRequired: {
        passed: byCategory.missingRequired.filter((r) => r.passed).length,
        total: byCategory.missingRequired.length,
      },
      wrongTypes: {
        passed: byCategory.wrongTypes.filter((r) => r.passed).length,
        total: byCategory.wrongTypes.length,
      },
      edgeCases: {
        passed: byCategory.edgeCases.filter((r) => r.passed).length,
        total: byCategory.edgeCases.length,
      },
      boundaries: {
        passed: byCategory.boundaries.filter((r) => r.passed).length,
        total: byCategory.boundaries.length,
      },
      fuzzing: {
        passed: byCategory.fuzzing.filter((r) => r.passed).length,
        total: byCategory.fuzzing.length,
      },
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, results);

    return {
      toolName,
      totalTests,
      passedTests,
      failedTests,
      successRate,
      duration,
      testCases: results,
      summary,
      recommendations,
    };
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(
    summary: ToolTestResults["summary"],
    results: TestCaseResult[],
  ): string[] {
    const recommendations: string[] = [];

    // Check valid cases
    if (summary.validCases.total > 0 && summary.validCases.passed === 0) {
      recommendations.push(
        "❌ CRITICAL: Tool fails on all valid inputs. Check basic functionality.",
      );
    } else if (summary.validCases.passed < summary.validCases.total * 0.8) {
      recommendations.push(
        "⚠️ Tool has inconsistent behavior with valid inputs. Review implementation.",
      );
    }

    // Check missing required parameters
    if (
      summary.missingRequired.total > 0 &&
      summary.missingRequired.passed < summary.missingRequired.total * 0.8
    ) {
      recommendations.push(
        "⚠️ Tool does not properly validate required parameters. Add validation.",
      );
    }

    // Check wrong type handling
    if (
      summary.wrongTypes.total > 0 &&
      summary.wrongTypes.passed < summary.wrongTypes.total * 0.8
    ) {
      recommendations.push(
        "⚠️ Tool does not properly handle wrong parameter types. Add type checking.",
      );
    }

    // Check edge cases
    if (
      summary.edgeCases.total > 0 &&
      summary.edgeCases.passed < summary.edgeCases.total * 0.5
    ) {
      recommendations.push(
        "⚠️ Tool struggles with edge cases (empty strings, nulls, etc.). Add edge case handling.",
      );
    }

    // Check fuzzing
    if (
      summary.fuzzing.total > 0 &&
      summary.fuzzing.passed < summary.fuzzing.total * 0.7
    ) {
      recommendations.push(
        "🔒 SECURITY: Tool may be vulnerable to injection attacks. Add input sanitization.",
      );
    }

    // Check boundaries
    if (
      summary.boundaries.total > 0 &&
      summary.boundaries.passed < summary.boundaries.total * 0.8
    ) {
      recommendations.push(
        "⚠️ Tool does not handle boundary values well. Check min/max constraints.",
      );
    }

    // Performance check
    const avgDuration =
      results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    if (avgDuration > 3000) {
      recommendations.push(
        `⏱️ PERFORMANCE: Average response time is ${avgDuration.toFixed(0)}ms. Consider optimization.`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "✅ Tool passed all tests. Excellent implementation!",
      );
    }

    return recommendations;
  }

  /**
   * Generate test name
   */
  private getTestName(
    category: TestCaseResult["category"],
    input: Record<string, unknown>,
  ): string {
    const categoryNames = {
      valid: "Valid input",
      missing_required: "Missing required parameter",
      wrong_type: "Wrong parameter type",
      edge_case: "Edge case",
      boundary: "Boundary value",
      fuzzing: "Security fuzzing",
    };

    const baseName = categoryNames[category];
    const params = Object.keys(input).slice(0, 2).join(", ");
    return `${baseName} (${params || "no params"})`;
  }

  /**
   * Execute promise with timeout
   */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
      ),
    ]);
  }

  /**
   * Chunk array into batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * Quick test runner for common scenarios
 */
export async function quickTest(
  tool: Tool,
  callTool: (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<CompatibilityCallToolResult>,
): Promise<ToolTestResults> {
  const harness = new TestHarness({
    timeout: 3000,
    includeValidTests: true,
    includeMissingRequiredTests: true,
    includeWrongTypeTests: true,
    includeEdgeCaseTests: false,
    includeBoundaryTests: false,
    includeFuzzingTests: false,
    verboseLogging: false,
  });

  return harness.runToolTests(tool, callTool);
}

/**
 * Comprehensive test runner (all tests)
 */
export async function comprehensiveTest(
  tool: Tool,
  callTool: (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<CompatibilityCallToolResult>,
): Promise<ToolTestResults> {
  const harness = new TestHarness({
    timeout: 5000,
    includeValidTests: true,
    includeMissingRequiredTests: true,
    includeWrongTypeTests: true,
    includeEdgeCaseTests: true,
    includeBoundaryTests: true,
    includeFuzzingTests: true,
    parallelExecution: false,
    verboseLogging: true,
  });

  return harness.runToolTests(tool, callTool);
}

/**
 * Security-focused test runner
 */
export async function securityTest(
  tool: Tool,
  callTool: (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<CompatibilityCallToolResult>,
): Promise<ToolTestResults> {
  const harness = new TestHarness({
    timeout: 5000,
    includeValidTests: false,
    includeMissingRequiredTests: false,
    includeWrongTypeTests: false,
    includeEdgeCaseTests: true,
    includeBoundaryTests: false,
    includeFuzzingTests: true,
    verboseLogging: true,
  });

  return harness.runToolTests(tool, callTool);
}
