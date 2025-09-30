/**
 * Test Data Generator
 * Automatically generates valid, invalid, edge case, and boundary test data
 * based on JSON schemas
 */

import type { JsonSchemaType } from "./jsonUtils";

/**
 * Test data generation strategies
 */
export type TestDataStrategy =
  | "valid" // Generate valid data
  | "invalid" // Generate invalid data for error testing
  | "edge" // Generate edge cases (empty, null, etc.)
  | "boundary" // Generate boundary values (min, max)
  | "fuzzing"; // Generate random/malicious data

/**
 * Generated test case
 */
export interface GeneratedTestCase {
  description: string;
  data: unknown;
  expectedValid: boolean;
  category: TestDataStrategy;
  notes?: string;
}

/**
 * Test data generator configuration
 */
export interface TestDataConfig {
  strategy: TestDataStrategy;
  includeOptional?: boolean; // Include optional fields in valid data
  maxArrayItems?: number; // Max items for array generation
  maxStringLength?: number; // Max length for string generation
  includeUnicodeEdgeCases?: boolean; // Include unicode characters
  includeSQLInjection?: boolean; // Include SQL injection patterns
  includeXSS?: boolean; // Include XSS patterns
}

const DEFAULT_CONFIG: Required<TestDataConfig> = {
  strategy: "valid",
  includeOptional: false,
  maxArrayItems: 5,
  maxStringLength: 50,
  includeUnicodeEdgeCases: true,
  includeSQLInjection: true,
  includeXSS: true,
};

/**
 * Generate test data based on JSON schema
 */
export function generateTestData(
  schema: JsonSchemaType,
  config: Partial<TestDataConfig> = {}
): unknown {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  switch (fullConfig.strategy) {
    case "valid":
      return generateValidData(schema, fullConfig);
    case "invalid":
      return generateInvalidData(schema, fullConfig);
    case "edge":
      return generateEdgeCaseData(schema, fullConfig);
    case "boundary":
      return generateBoundaryData(schema, fullConfig);
    case "fuzzing":
      return generateFuzzingData(schema, fullConfig);
    default:
      return generateValidData(schema, fullConfig);
  }
}

/**
 * Generate valid test data
 */
function generateValidData(
  schema: JsonSchemaType,
  config: Required<TestDataConfig>
): unknown {
  // Handle default value
  if ("default" in schema && schema.default !== undefined) {
    return schema.default;
  }

  // Handle anyOf (union types)
  if (schema.anyOf) {
    const nonNullOption = schema.anyOf.find(
      (opt) => (opt as JsonSchemaType).type !== "null"
    );
    if (nonNullOption) {
      return generateValidData(nonNullOption as JsonSchemaType, config);
    }
  }

  switch (schema.type) {
    case "string":
      if (schema.enum) {
        return schema.enum[0]; // First enum value
      }
      if (schema.format === "email") {
        return "test@example.com";
      }
      if (schema.format === "date") {
        return new Date().toISOString().split("T")[0];
      }
      if (schema.format === "date-time") {
        return new Date().toISOString();
      }
      if (schema.format === "uri" || schema.format === "url") {
        return "https://example.com";
      }
      // Generate string within constraints
      const minLength = schema.minLength || 1;
      const maxLength = Math.min(
        schema.maxLength || config.maxStringLength,
        config.maxStringLength
      );
      const length = Math.max(minLength, Math.min(maxLength, 10));
      return generateRandomString(length, schema.pattern);

    case "number":
    case "integer":
      const min = schema.minimum ?? 0;
      const max = schema.maximum ?? 100;
      const multipleOf = schema.multipleOf || 1;
      const value = Math.floor(Math.random() * (max - min + 1)) + min;
      return schema.type === "integer"
        ? Math.floor(value / multipleOf) * multipleOf
        : value;

    case "boolean":
      return true;

    case "array": {
      const items = schema.items as JsonSchemaType | undefined;
      if (!items) return [];

      const minItems = schema.minItems || 0;
      const maxItems = Math.min(
        schema.maxItems || config.maxArrayItems,
        config.maxArrayItems
      );
      const itemCount = Math.max(minItems, Math.min(maxItems, 2));

      return Array.from({ length: itemCount }, () =>
        generateValidData(items, config)
      );
    }

    case "object": {
      if (!schema.properties) return {};

      const obj: Record<string, unknown> = {};
      const required = schema.required || [];

      Object.entries(schema.properties).forEach(([key, propSchema]) => {
        const isRequired = required.includes(key);
        if (isRequired || config.includeOptional) {
          obj[key] = generateValidData(propSchema as JsonSchemaType, config);
        }
      });

      return obj;
    }

    case "null":
      return null;

    default:
      return undefined;
  }
}

/**
 * Generate invalid test data (for testing error handling)
 */
function generateInvalidData(
  schema: JsonSchemaType,
  _config: Required<TestDataConfig>
): unknown {
  switch (schema.type) {
    case "string":
      // Return wrong type
      return 12345;

    case "number":
    case "integer":
      // Return string instead of number
      return "not a number";

    case "boolean":
      // Return string instead of boolean
      return "not a boolean";

    case "array":
      // Return non-array
      return { notAnArray: true };

    case "object":
      // Return non-object
      return "not an object";

    default:
      return undefined;
  }
}

/**
 * Generate edge case data
 */
function generateEdgeCaseData(
  schema: JsonSchemaType,
  config: Required<TestDataConfig>
): unknown {
  const edgeCases: Record<string, unknown[]> = {
    string: [
      "", // Empty string
      " ", // Single space
      "  ", // Multiple spaces
      "\n", // Newline
      "\t", // Tab
      "null", // String "null"
      "undefined", // String "undefined"
    ],
    number: [0, -0, NaN, Infinity, -Infinity],
    integer: [0, -1, 1],
    boolean: [true, false],
    array: [[], null, undefined],
    object: [{}, null, undefined],
  };

  if (config.includeUnicodeEdgeCases && schema.type === "string") {
    edgeCases.string.push(
      "🔥", // Emoji
      "مرحبا", // RTL text
      "你好", // CJK characters
      "\u0000", // Null byte
      "\uFFFD" // Replacement character
    );
  }

  const cases = edgeCases[schema.type as keyof typeof edgeCases] || [];
  return cases[Math.floor(Math.random() * cases.length)];
}

/**
 * Generate boundary value data
 */
function generateBoundaryData(
  schema: JsonSchemaType,
  config: Required<TestDataConfig>
): unknown {
  switch (schema.type) {
    case "string":
      if (schema.minLength !== undefined) {
        // Test min length
        return "x".repeat(schema.minLength);
      }
      if (schema.maxLength !== undefined) {
        // Test max length
        return "x".repeat(schema.maxLength);
      }
      if (schema.minLength === undefined && schema.maxLength === undefined) {
        // Very long string
        return "x".repeat(1000);
      }
      return "";

    case "number":
    case "integer":
      if (schema.minimum !== undefined) {
        return schema.minimum;
      }
      if (schema.maximum !== undefined) {
        return schema.maximum;
      }
      // JavaScript safe integer boundaries
      return schema.type === "integer"
        ? Number.MAX_SAFE_INTEGER
        : Number.MAX_VALUE;

    case "array": {
      const items = schema.items as JsonSchemaType | undefined;
      if (!items) return [];

      if (schema.minItems !== undefined) {
        return Array.from({ length: schema.minItems }, () =>
          generateValidData(items, config)
        );
      }
      if (schema.maxItems !== undefined) {
        return Array.from({ length: schema.maxItems }, () =>
          generateValidData(items, config)
        );
      }
      return [];
    }

    default:
      return generateValidData(schema, config);
  }
}

/**
 * Generate fuzzing data (random/malicious)
 */
function generateFuzzingData(
  schema: JsonSchemaType,
  config: Required<TestDataConfig>
): unknown {
  const fuzzPatterns: string[] = [];

  // SQL Injection patterns
  if (config.includeSQLInjection) {
    fuzzPatterns.push(
      "' OR '1'='1",
      "'; DROP TABLE users--",
      "1' UNION SELECT NULL--",
      "admin'--",
      "' OR 1=1--"
    );
  }

  // XSS patterns
  if (config.includeXSS) {
    fuzzPatterns.push(
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert('XSS')>",
      "javascript:alert('XSS')",
      "<iframe src='javascript:alert(1)'>",
      "'\"><script>alert(String.fromCharCode(88,83,83))</script>"
    );
  }

  // Path traversal
  fuzzPatterns.push("../../etc/passwd", "../../../windows/system32");

  // Command injection
  fuzzPatterns.push(
    "; rm -rf /",
    "| whoami",
    "&& cat /etc/passwd",
    "`cat /etc/passwd`"
  );

  // Format string attacks
  fuzzPatterns.push("%s%s%s%s%s", "%n%n%n%n%n", "%x%x%x%x%x");

  // Unicode tricks
  if (config.includeUnicodeEdgeCases) {
    fuzzPatterns.push(
      "\u0000", // Null byte
      "\uFEFF", // Zero-width no-break space
      "\u202E", // Right-to-left override
      "test\u0000.txt" // Null byte in filename
    );
  }

  if (schema.type === "string") {
    return fuzzPatterns[Math.floor(Math.random() * fuzzPatterns.length)];
  }

  // For non-strings, return type confusion
  return fuzzPatterns[0];
}

/**
 * Generate test cases for all strategies
 */
export function generateAllTestCases(
  schema: JsonSchemaType,
  config: Partial<TestDataConfig> = {}
): GeneratedTestCase[] {
  const strategies: TestDataStrategy[] = [
    "valid",
    "invalid",
    "edge",
    "boundary",
    "fuzzing",
  ];

  return strategies.flatMap((strategy) => {
    const strategyConfig = { ...config, strategy };

    // Generate multiple samples for some strategies
    const sampleCount = strategy === "fuzzing" || strategy === "edge" ? 3 : 1;

    return Array.from({ length: sampleCount }, (_, i) => ({
      description: getTestDescription(strategy, schema, i),
      data: generateTestData(schema, strategyConfig),
      expectedValid: strategy === "valid",
      category: strategy,
      notes: getTestNotes(strategy, schema),
    }));
  });
}

/**
 * Generate test description
 */
function getTestDescription(
  strategy: TestDataStrategy,
  schema: JsonSchemaType,
  index: number
): string {
  const type = schema.type || "unknown";
  const baseDesc = {
    valid: `Valid ${type} data`,
    invalid: `Invalid ${type} data (wrong type)`,
    edge: `Edge case #${index + 1} for ${type}`,
    boundary: `Boundary value for ${type}`,
    fuzzing: `Fuzzing pattern #${index + 1} for ${type}`,
  };

  return baseDesc[strategy] || `Test ${strategy} for ${type}`;
}

/**
 * Get test notes
 */
function getTestNotes(
  strategy: TestDataStrategy,
  _schema: JsonSchemaType
): string | undefined {
  const notes: Record<TestDataStrategy, string> = {
    valid: "Should pass validation",
    invalid: "Should fail with type error",
    edge: "Tests edge cases like empty, null, special characters",
    boundary: "Tests min/max constraints",
    fuzzing: "Tests security vulnerabilities and malicious input",
  };

  return notes[strategy];
}

/**
 * Helper: Generate random string
 */
function generateRandomString(length: number, pattern?: string): string {
  if (pattern) {
    // Try to generate string matching pattern (simplified)
    // For now, use alphanumeric
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from(
      { length },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  }

  // Random words
  const words = [
    "test",
    "data",
    "sample",
    "example",
    "demo",
    "value",
    "input",
    "output",
  ];
  let result = "";
  while (result.length < length) {
    const word = words[Math.floor(Math.random() * words.length)];
    result += word + " ";
  }
  return result.trim().substring(0, length);
}

/**
 * Generate test cases for tool parameters
 */
export function generateToolParameterTests(
  properties: Record<string, JsonSchemaType>,
  _required: string[] = []
): Record<string, GeneratedTestCase[]> {
  const testCases: Record<string, GeneratedTestCase[]> = {};

  Object.entries(properties).forEach(([paramName, schema]) => {
    testCases[paramName] = generateAllTestCases(schema);
  });

  return testCases;
}

/**
 * Generate complete test suite for a tool
 */
export interface ToolTestSuite {
  valid: Record<string, unknown>[];
  missingRequired: Record<string, unknown>[];
  wrongTypes: Record<string, unknown>[];
  edgeCases: Record<string, unknown>[];
  boundaries: Record<string, unknown>[];
  fuzzing: Record<string, unknown>[];
}

export function generateToolTestSuite(
  properties: Record<string, JsonSchemaType>,
  required: string[] = []
): ToolTestSuite {
  const suite: ToolTestSuite = {
    valid: [],
    missingRequired: [],
    wrongTypes: [],
    edgeCases: [],
    boundaries: [],
    fuzzing: [],
  };

  // Generate valid cases
  const validConfig: TestDataConfig = { strategy: "valid", includeOptional: true };
  for (let i = 0; i < 3; i++) {
    const validCase: Record<string, unknown> = {};
    Object.entries(properties).forEach(([key, schema]) => {
      validCase[key] = generateTestData(schema, validConfig);
    });
    suite.valid.push(validCase);
  }

  // Generate missing required cases
  required.forEach((requiredParam) => {
    const missingCase: Record<string, unknown> = {};
    Object.entries(properties).forEach(([key, schema]) => {
      if (key !== requiredParam) {
        missingCase[key] = generateTestData(schema, { strategy: "valid" });
      }
    });
    suite.missingRequired.push(missingCase);
  });

  // Generate wrong type cases
  Object.entries(properties).forEach(([key, _schema]) => {
    const wrongTypeCase: Record<string, unknown> = {};
    Object.entries(properties).forEach(([k, s]) => {
      wrongTypeCase[k] =
        k === key
          ? generateTestData(s, { strategy: "invalid" })
          : generateTestData(s, { strategy: "valid" });
    });
    suite.wrongTypes.push(wrongTypeCase);
  });

  // Generate edge cases
  Object.entries(properties).forEach(([key, _schema]) => {
    for (let i = 0; i < 2; i++) {
      const edgeCase: Record<string, unknown> = {};
      Object.entries(properties).forEach(([k, s]) => {
        edgeCase[k] =
          k === key
            ? generateTestData(s, { strategy: "edge" })
            : generateTestData(s, { strategy: "valid" });
      });
      suite.edgeCases.push(edgeCase);
    }
  });

  // Generate boundary cases
  Object.entries(properties).forEach(([key, _schema]) => {
    const boundaryCase: Record<string, unknown> = {};
    Object.entries(properties).forEach(([k, s]) => {
      boundaryCase[k] =
        k === key
          ? generateTestData(s, { strategy: "boundary" })
          : generateTestData(s, { strategy: "valid" });
    });
    suite.boundaries.push(boundaryCase);
  });

  // Generate fuzzing cases
  for (let i = 0; i < 5; i++) {
    const fuzzCase: Record<string, unknown> = {};
    Object.entries(properties).forEach(([key, schema]) => {
      fuzzCase[key] = generateTestData(schema, { strategy: "fuzzing" });
    });
    suite.fuzzing.push(fuzzCase);
  }

  return suite;
}