/**
 * Sample MCP Tool Definitions for Local Development
 * These fixtures enable offline testing and faster iteration
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Simple tools with basic parameter types
 */
export const SIMPLE_TOOLS: Tool[] = [
  {
    name: "echo",
    description: "Echoes back the input message",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message to echo back",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "add_numbers",
    description: "Adds two numbers together",
    inputSchema: {
      type: "object",
      properties: {
        a: {
          type: "number",
          description: "First number",
        },
        b: {
          type: "number",
          description: "Second number",
        },
      },
      required: ["a", "b"],
    },
  },
  {
    name: "get_user_info",
    description: "Retrieves user information by ID",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "The user ID to look up",
        },
        includeDetails: {
          type: "boolean",
          description: "Whether to include detailed information",
          default: false,
        },
      },
      required: ["userId"],
    },
  },
];

/**
 * Complex tools with nested objects and arrays
 */
export const COMPLEX_TOOLS: Tool[] = [
  {
    name: "create_user",
    description: "Creates a new user with profile information",
    inputSchema: {
      type: "object",
      properties: {
        username: {
          type: "string",
          description: "Unique username",
        },
        email: {
          type: "string",
          format: "email",
          description: "User email address",
        },
        profile: {
          type: "object",
          description: "User profile information",
          properties: {
            firstName: {
              type: "string",
              description: "First name",
            },
            lastName: {
              type: "string",
              description: "Last name",
            },
            age: {
              type: "integer",
              minimum: 0,
              maximum: 150,
              description: "User age",
            },
            interests: {
              type: "array",
              description: "List of interests",
              items: {
                type: "string",
              },
            },
          },
          required: ["firstName", "lastName"],
        },
        settings: {
          type: "object",
          description: "User settings",
          properties: {
            notifications: {
              type: "boolean",
              default: true,
            },
            theme: {
              type: "string",
              enum: ["light", "dark", "auto"],
              default: "auto",
            },
          },
        },
      },
      required: ["username", "email", "profile"],
    },
  },
  {
    name: "search_documents",
    description: "Search documents with advanced filters",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query string",
        },
        filters: {
          type: "object",
          description: "Search filters",
          properties: {
            tags: {
              type: "array",
              description: "Filter by tags",
              items: {
                type: "string",
              },
            },
            dateRange: {
              type: "object",
              properties: {
                start: {
                  type: "string",
                  format: "date",
                },
                end: {
                  type: "string",
                  format: "date",
                },
              },
            },
            status: {
              type: "string",
              enum: ["draft", "published", "archived"],
            },
          },
        },
        sort: {
          type: "object",
          properties: {
            field: {
              type: "string",
              enum: ["date", "title", "relevance"],
            },
            order: {
              type: "string",
              enum: ["asc", "desc"],
            },
          },
        },
        pagination: {
          type: "object",
          properties: {
            page: {
              type: "integer",
              minimum: 1,
              default: 1,
            },
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 10,
            },
          },
        },
      },
      required: ["query"],
    },
  },
];

/**
 * Tools for testing edge cases and error handling
 */
export const EDGE_CASE_TOOLS: Tool[] = [
  {
    name: "validate_input",
    description: "Tests various input validation scenarios",
    inputSchema: {
      type: "object",
      properties: {
        stringField: {
          type: "string",
          minLength: 3,
          maxLength: 50,
          pattern: "^[a-zA-Z0-9_]+$",
        },
        numberField: {
          type: "number",
          minimum: 0,
          maximum: 100,
          multipleOf: 5,
        },
        enumField: {
          type: "string",
          enum: ["option1", "option2", "option3"],
        },
        optionalField: {
          anyOf: [{ type: "string" }, { type: "null" }],
          description: "Optional nullable string",
        },
      },
      required: ["stringField", "numberField", "enumField"],
    },
  },
  {
    name: "file_operation",
    description: "Performs file operations (for security testing)",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: ["read", "write", "delete", "list"],
        },
        path: {
          type: "string",
          description: "File path (test for injection vulnerabilities)",
        },
        content: {
          type: "string",
          description: "Content for write operations",
        },
      },
      required: ["operation", "path"],
    },
  },
];

/**
 * Tools with output schemas for validation testing
 */
export const SCHEMA_VALIDATION_TOOLS: Tool[] = [
  {
    name: "get_weather",
    description: "Gets weather information with typed output",
    inputSchema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City name or coordinates",
        },
      },
      required: ["location"],
    },
    outputSchema: {
      type: "object",
      properties: {
        temperature: {
          type: "number",
          description: "Temperature in Celsius",
        },
        condition: {
          type: "string",
          enum: ["sunny", "cloudy", "rainy", "snowy"],
        },
        humidity: {
          type: "number",
          minimum: 0,
          maximum: 100,
        },
      },
      required: ["temperature", "condition"],
    },
  },
];

/**
 * Tools that simulate long-running operations
 */
export const ASYNC_TOOLS: Tool[] = [
  {
    name: "process_data",
    description: "Simulates a long-running data processing operation",
    inputSchema: {
      type: "object",
      properties: {
        dataSize: {
          type: "integer",
          minimum: 1,
          maximum: 1000,
          description: "Size of data to process (simulates delay)",
        },
        shouldFail: {
          type: "boolean",
          default: false,
          description: "Whether to simulate a failure",
        },
      },
      required: ["dataSize"],
    },
  },
];

/**
 * All sample tools combined by category
 */
export const ALL_SAMPLE_TOOLS: Record<string, Tool[]> = {
  simple: SIMPLE_TOOLS,
  complex: COMPLEX_TOOLS,
  edgeCase: EDGE_CASE_TOOLS,
  schemaValidation: SCHEMA_VALIDATION_TOOLS,
  async: ASYNC_TOOLS,
};

/**
 * Flat array of all tools
 */
export const ALL_TOOLS_FLAT: Tool[] = [
  ...SIMPLE_TOOLS,
  ...COMPLEX_TOOLS,
  ...EDGE_CASE_TOOLS,
  ...SCHEMA_VALIDATION_TOOLS,
  ...ASYNC_TOOLS,
];

/**
 * Get tools by category
 */
export function getToolsByCategory(category: keyof typeof ALL_SAMPLE_TOOLS): Tool[] {
  return ALL_SAMPLE_TOOLS[category] || [];
}

/**
 * Get a specific tool by name
 */
export function getToolByName(name: string): Tool | undefined {
  return ALL_TOOLS_FLAT.find((tool) => tool.name === name);
}