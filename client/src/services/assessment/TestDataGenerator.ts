/**
 * Smart Test Data Generator for MCP Tool Testing
 * Generates realistic, context-aware test data based on parameter schemas
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { isJSONSchemaProperty, safeGetProperty } from "@/utils/typeGuards";

export interface TestScenario {
  name: string;
  description: string;
  params: Record<string, unknown>;
  expectedBehavior: string;
  category: "happy_path" | "edge_case" | "boundary" | "error_case";
}

export class TestDataGenerator {
  // Realistic data pools for different types - using values that are more likely to exist
  private static readonly REALISTIC_DATA = {
    urls: [
      "https://www.google.com", // Public, always accessible
      "https://api.github.com/users/octocat", // Public API endpoint that exists
      "https://jsonplaceholder.typicode.com/posts/1", // Test API that always works
      "https://httpbin.org/get", // HTTP testing service
      "https://example.com", // RFC 2606 reserved domain for examples
      "https://www.wikipedia.org", // Public, stable site
      "https://api.openweathermap.org/data/2.5/weather?q=London", // Public API
    ],
    emails: [
      "admin@example.com", // Common admin email
      "support@example.com", // Common support email
      "info@example.com", // Common info email
      "test@test.com", // Generic test email
      "user@domain.com", // Generic user email
      "noreply@example.com", // Common no-reply format
      "hello@world.com", // Simple, memorable
    ],
    names: [
      "Default", // Common default name
      "Admin", // Common admin user
      "Test User", // Clear test user
      "Sample Item", // Generic sample
      "Example Project", // Clear example
      "Demo Application", // Common demo name
      "Main", // Common main/primary name
    ],
    ids: [
      "1", // Simple numeric ID that often exists
      "123", // Common test ID
      "test", // String ID that might exist
      "default", // Common default ID
      "main", // Common main ID
      "550e8400-e29b-41d4-a716-446655440000", // Valid UUID v4
      "00000000-0000-0000-0000-000000000000", // Nil UUID (often used as placeholder)
      "admin", // Common admin ID
      "user1", // Common user ID pattern
    ],
    paths: [
      "/tmp/test.txt", // Common temp file path (usually writable)
      "/home", // Common home directory
      "./README.md", // Often exists in projects
      "./package.json", // Common in Node projects
      "./src", // Common source directory
      "./test", // Common test directory
      "./config", // Common config directory
      "/var/log", // Common log directory (readable)
      "/etc", // Common config directory (readable)
    ],
    queries: [
      "test", // Simple search term
      "hello", // Common greeting
      "*", // Wildcard that matches everything
      "name", // Common field name
      "id:1", // Common ID search
      "status:active", // Common status filter
      "type:user", // Common type filter
      "limit:10", // Common pagination
      '{"match_all": {}}', // Elasticsearch match all
    ],
    numbers: [0, 1, 10, 100, 1000, 5, 50, 200, 404, 500],
    booleans: [true, false],
    jsonObjects: [
      { message: "Hello World" }, // Simple message object
      { status: "ok", code: 200 }, // Common status response
      { data: [], total: 0 }, // Empty result set
      { id: 1, name: "Test" }, // Simple entity
      { success: true }, // Common success response
      { error: false }, // Common no-error response
      { results: [] }, // Common empty results
      {}, // Empty object (often valid)
    ],
    arrays: [
      [], // Empty array (often valid)
      [1], // Single item
      ["a", "b", "c"], // Simple string array
      [1, 2, 3], // Simple number array
      [{ id: 1 }, { id: 2 }], // Simple object array
      ["test"], // Single test item
      [true, false], // Boolean array
    ],
    timestamps: [
      new Date().toISOString(), // Current time (always valid)
      new Date(Date.now() - 86400000).toISOString(), // Yesterday
      new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      "2024-01-01T00:00:00Z", // New Year 2024
      "2023-12-31T23:59:59Z", // End of 2023
      new Date(0).toISOString(), // Unix epoch
      "2024-06-15T12:00:00Z", // Midday mid-year
    ],
  };

  /**
   * Generate multiple test scenarios for a tool
   */
  static generateTestScenarios(tool: Tool): TestScenario[] {
    const scenarios: TestScenario[] = [];

    // Always include at least one happy path scenario
    scenarios.push(this.generateHappyPathScenario(tool));

    // Add edge cases based on tool complexity
    const edgeCases = this.generateEdgeCaseScenarios(tool);
    scenarios.push(...edgeCases);

    // Add boundary value scenarios for numeric inputs
    const boundaryScenarios = this.generateBoundaryScenarios(tool);
    scenarios.push(...boundaryScenarios);

    // Add one error scenario to test error handling
    scenarios.push(this.generateErrorScenario(tool));

    return scenarios;
  }

  /**
   * Generate a happy path scenario with realistic data
   */
  private static generateHappyPathScenario(tool: Tool): TestScenario {
    const params = this.generateRealisticParams(tool, "typical");

    return {
      name: "Happy Path - Typical Usage",
      description: `Test ${tool.name} with typical, valid inputs`,
      params,
      expectedBehavior: "Should execute successfully and return valid response",
      category: "happy_path",
    };
  }

  /**
   * Generate edge case scenarios
   */
  private static generateEdgeCaseScenarios(tool: Tool): TestScenario[] {
    const scenarios: TestScenario[] = [];

    // Empty values scenario (where applicable)
    const emptyParams = this.generateRealisticParams(tool, "empty");
    if (Object.keys(emptyParams).length > 0) {
      scenarios.push({
        name: "Edge Case - Empty Values",
        description: "Test with empty but valid values",
        params: emptyParams,
        expectedBehavior: "Should handle empty values gracefully",
        category: "edge_case",
      });
    }

    // Maximum values scenario
    const maxParams = this.generateRealisticParams(tool, "maximum");
    scenarios.push({
      name: "Edge Case - Maximum Values",
      description: "Test with maximum/large values",
      params: maxParams,
      expectedBehavior: "Should handle large inputs without issues",
      category: "edge_case",
    });

    // Special characters scenario (for string inputs)
    if (this.hasStringInputs(tool)) {
      const specialParams = this.generateRealisticParams(tool, "special");
      scenarios.push({
        name: "Edge Case - Special Characters",
        description: "Test with special characters and unicode",
        params: specialParams,
        expectedBehavior: "Should properly handle special characters",
        category: "edge_case",
      });
    }

    return scenarios;
  }

  /**
   * Generate boundary value scenarios
   */
  private static generateBoundaryScenarios(tool: Tool): TestScenario[] {
    const scenarios: TestScenario[] = [];

    if (!tool.inputSchema || tool.inputSchema.type !== "object") {
      return scenarios;
    }

    const properties = tool.inputSchema.properties || {};

    for (const [key, schema] of Object.entries(properties)) {
      // Use type guard to safely access schema properties
      if (!isJSONSchemaProperty(schema)) {
        continue; // Skip invalid schemas
      }

      // Test numeric boundaries
      if (schema.type === "number" || schema.type === "integer") {
        const minimum = safeGetProperty(schema, "minimum", (v): v is number => typeof v === "number");
        if (minimum !== undefined) {
          const params = this.generateRealisticParams(tool, "typical");
          params[key] = minimum;
          scenarios.push({
            name: `Boundary - ${key} at minimum`,
            description: `Test ${key} at its minimum value`,
            params,
            expectedBehavior: "Should accept minimum value",
            category: "boundary",
          });
        }

        const maximum = safeGetProperty(schema, "maximum", (v): v is number => typeof v === "number");
        if (maximum !== undefined) {
          const params = this.generateRealisticParams(tool, "typical");
          params[key] = maximum;
          scenarios.push({
            name: `Boundary - ${key} at maximum`,
            description: `Test ${key} at its maximum value`,
            params,
            expectedBehavior: "Should accept maximum value",
            category: "boundary",
          });
        }
      }

      // Test string length boundaries
      if (schema.type === "string") {
        const minLength = safeGetProperty(schema, "minLength", (v): v is number => typeof v === "number");
        if (minLength !== undefined) {
          const params = this.generateRealisticParams(tool, "typical");
          params[key] = "a".repeat(minLength);
          scenarios.push({
            name: `Boundary - ${key} at min length`,
            description: `Test ${key} at minimum length`,
            params,
            expectedBehavior: "Should accept minimum length string",
            category: "boundary",
          });
        }

        const maxLength = safeGetProperty(schema, "maxLength", (v): v is number => typeof v === "number");
        if (maxLength !== undefined) {
          const params = this.generateRealisticParams(tool, "typical");
          params[key] = "a".repeat(maxLength);
          scenarios.push({
            name: `Boundary - ${key} at max length`,
            description: `Test ${key} at maximum length`,
            params,
            expectedBehavior: "Should accept maximum length string",
            category: "boundary",
          });
        }
      }
    }

    return scenarios;
  }

  /**
   * Generate an error scenario
   */
  private static generateErrorScenario(tool: Tool): TestScenario {
    const params: Record<string, unknown> = {};

    if (
      tool.inputSchema &&
      tool.inputSchema.type === "object" &&
      tool.inputSchema.properties
    ) {
      // Intentionally provide wrong types
      for (const [key, schema] of Object.entries(tool.inputSchema.properties)) {
        // Use type guard to safely access schema properties
        if (!isJSONSchemaProperty(schema)) {
          continue; // Skip invalid schemas
        }

        switch (schema.type) {
          case "string":
            params[key] = 123; // Wrong type
            break;
          case "number":
          case "integer":
            params[key] = "not_a_number"; // Wrong type
            break;
          case "boolean":
            params[key] = "not_a_boolean"; // Wrong type
            break;
          case "array":
            params[key] = "not_an_array"; // Wrong type
            break;
          case "object":
            params[key] = "not_an_object"; // Wrong type
            break;
          default:
            params[key] = null;
        }

        // Only set one wrong parameter to make the error clear
        break;
      }
    }

    return {
      name: "Error Case - Invalid Type",
      description: "Test error handling with invalid parameter types",
      params,
      expectedBehavior:
        "Should return clear error about invalid parameter type",
      category: "error_case",
    };
  }

  /**
   * Generate realistic parameters based on schema and variant
   */
  public static generateRealisticParams(
    tool: Tool,
    variant: "typical" | "empty" | "maximum" | "special",
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    if (!tool.inputSchema || tool.inputSchema.type !== "object") {
      return params;
    }

    const properties = tool.inputSchema.properties || {};

    for (const [key, schema] of Object.entries(properties)) {
      params[key] = this.generateRealisticValue(key, schema, variant);
    }

    return params;
  }

  /**
   * Generate a realistic value based on field name and schema
   */
  private static generateRealisticValue(
    fieldName: string,
    schema: unknown,
    variant: "typical" | "empty" | "maximum" | "special",
  ): unknown {
    const lowerFieldName = fieldName.toLowerCase();

    // Use type guard to safely access schema properties
    if (!isJSONSchemaProperty(schema)) {
      return null; // Return null for invalid schema
    }

    switch (schema.type) {
      case "string":
        // Check for enums first using safe property access
        const enumValues = safeGetProperty(schema, "enum", (v): v is string[] => Array.isArray(v));
        if (enumValues && enumValues.length > 0) {
          return variant === "typical"
            ? enumValues[0]
            : enumValues[enumValues.length - 1];
        }

        // Context-aware string generation
        if (
          lowerFieldName.includes("url") ||
          lowerFieldName.includes("link") ||
          lowerFieldName.includes("endpoint")
        ) {
          return variant === "empty"
            ? ""
            : variant === "maximum"
              ? "https://very-long-domain-name-for-testing-maximum-length.example.com/path/to/resource?param1=value1&param2=value2"
              : variant === "special"
                ? "https://example.com/path?special=!@#$%^&*()"
                : this.REALISTIC_DATA.urls[
                    Math.floor(Math.random() * this.REALISTIC_DATA.urls.length)
                  ];
        }

        if (
          lowerFieldName.includes("email") ||
          lowerFieldName.includes("mail")
        ) {
          return variant === "empty"
            ? ""
            : variant === "maximum"
              ? "very.long.email.address.for.testing@subdomain.example-company.co.uk"
              : variant === "special"
                ? "user+tag@example.com"
                : this.REALISTIC_DATA.emails[
                    Math.floor(
                      Math.random() * this.REALISTIC_DATA.emails.length,
                    )
                  ];
        }

        if (
          lowerFieldName.includes("path") ||
          lowerFieldName.includes("file") ||
          lowerFieldName.includes("directory") ||
          lowerFieldName.includes("folder")
        ) {
          return variant === "empty"
            ? ""
            : variant === "maximum"
              ? "/very/long/path/to/deeply/nested/directory/structure/for/testing/file.txt"
              : variant === "special"
                ? "./path/with spaces/and-special#chars.txt"
                : this.REALISTIC_DATA.paths[
                    Math.floor(Math.random() * this.REALISTIC_DATA.paths.length)
                  ];
        }

        if (
          lowerFieldName.includes("query") ||
          lowerFieldName.includes("search") ||
          lowerFieldName.includes("filter")
        ) {
          return variant === "empty"
            ? ""
            : variant === "maximum"
              ? "very long search query with many terms for testing maximum input length handling"
              : variant === "special"
                ? 'search with "quotes" and special: characters!'
                : this.REALISTIC_DATA.queries[
                    Math.floor(
                      Math.random() * this.REALISTIC_DATA.queries.length,
                    )
                  ];
        }

        if (
          lowerFieldName.includes("id") ||
          lowerFieldName.includes("key") ||
          lowerFieldName.includes("identifier")
        ) {
          return variant === "empty"
            ? ""
            : variant === "maximum"
              ? "very_long_identifier_string_for_testing_maximum_length_handling_in_system"
              : this.REALISTIC_DATA.ids[
                  Math.floor(Math.random() * this.REALISTIC_DATA.ids.length)
                ];
        }

        if (
          lowerFieldName.includes("name") ||
          lowerFieldName.includes("title") ||
          lowerFieldName.includes("label")
        ) {
          return variant === "empty"
            ? ""
            : variant === "maximum"
              ? "Very Long Name For Testing Maximum String Length Handling In The System"
              : variant === "special"
                ? "Name with Special™ Characters® and Émojis 🎉"
                : this.REALISTIC_DATA.names[
                    Math.floor(Math.random() * this.REALISTIC_DATA.names.length)
                  ];
        }

        if (
          lowerFieldName.includes("date") ||
          lowerFieldName.includes("time")
        ) {
          return variant === "empty" ? "" : this.REALISTIC_DATA.timestamps[0];
        }

        // Default string value - try to be contextual
        return variant === "empty"
          ? ""
          : variant === "maximum"
            ? "x".repeat(100)
            : variant === "special"
              ? 'Special chars: !@#$%^&*()_+-=[]{}|;:",.<>?/~`'
              : "test"; // Simple, generic test value that often works

      case "number":
      case "integer":
        const maximum = safeGetProperty(schema, "maximum", (v): v is number => typeof v === "number");
        const minimum = safeGetProperty(schema, "minimum", (v): v is number => typeof v === "number");

        if (variant === "maximum") {
          return maximum || 999999;
        }
        if (variant === "empty") {
          return minimum || 0;
        }

        // Context-aware number generation
        if (lowerFieldName.includes("port")) {
          return 8080;
        }
        if (
          lowerFieldName.includes("timeout") ||
          lowerFieldName.includes("delay")
        ) {
          return 5000; // milliseconds
        }
        if (
          lowerFieldName.includes("count") ||
          lowerFieldName.includes("limit")
        ) {
          return 10;
        }
        if (
          lowerFieldName.includes("page") ||
          lowerFieldName.includes("offset")
        ) {
          return 0;
        }
        if (
          lowerFieldName.includes("size") ||
          lowerFieldName.includes("length")
        ) {
          return 100;
        }

        return minimum || 1;

      case "boolean":
        return variant === "empty" ? false : true;

      case "array":
        if (variant === "empty") {
          return [];
        }
        if (variant === "maximum") {
          return Array(10)
            .fill(0)
            .map((_, i) => `item_${i}`);
        }

        // Context-aware array generation
        if (
          lowerFieldName.includes("tag") ||
          lowerFieldName.includes("label")
        ) {
          return ["tag1", "tag2", "tag3"];
        }
        if (lowerFieldName.includes("id")) {
          return ["id_1", "id_2", "id_3"];
        }

        return this.REALISTIC_DATA.arrays[1];

      case "object":
        if (variant === "empty") {
          return {};
        }
        if (variant === "maximum") {
          return this.REALISTIC_DATA.jsonObjects[4]; // deeply nested
        }

        // Context-aware object generation
        if (
          lowerFieldName.includes("config") ||
          lowerFieldName.includes("settings")
        ) {
          return { enabled: true, timeout: 5000, retries: 3 };
        }
        if (
          lowerFieldName.includes("metadata") ||
          lowerFieldName.includes("meta")
        ) {
          return {
            created: new Date().toISOString(),
            version: "1.0.0",
            author: "test",
          };
        }
        if (
          lowerFieldName.includes("filter") ||
          lowerFieldName.includes("query")
        ) {
          return { status: "active", type: "user", limit: 10 };
        }

        return this.REALISTIC_DATA.jsonObjects[0];

      default:
        return null;
    }
  }

  /**
   * Check if tool has string inputs
   */
  private static hasStringInputs(tool: Tool): boolean {
    if (!tool.inputSchema || tool.inputSchema.type !== "object") {
      return false;
    }

    const properties = tool.inputSchema.properties || {};

    for (const schema of Object.values(properties)) {
      if (isJSONSchemaProperty(schema) && schema.type === "string") {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate a single realistic value for backward compatibility
   */
  static generateSingleValue(fieldName: string, schema: unknown): unknown {
    return this.generateRealisticValue(fieldName, schema, "typical");
  }
}
