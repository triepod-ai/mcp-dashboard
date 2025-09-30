/**
 * Usability Assessor Module
 * Evaluates tool naming, parameter clarity, and best practices
 */

import {
  UsabilityAssessment,
  UsabilityMetrics,
  AssessmentStatus,
} from "@/lib/assessmentTypes";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { BaseAssessor } from "./BaseAssessor";
import { AssessmentContext } from "../AssessmentOrchestrator";
import { JSONObject } from "@/lib/types/assessment";

export class UsabilityAssessor extends BaseAssessor {
  async assess(context: AssessmentContext): Promise<UsabilityAssessment> {
    this.log("Starting usability assessment");

    const metrics = this.analyzeUsability(context.tools);
    const status = this.determineUsabilityStatus(metrics);
    const explanation = this.generateExplanation(metrics, context.tools);
    const recommendations = this.generateRecommendations(metrics);

    return {
      metrics,
      status,
      explanation,
      recommendations,
    };
  }

  private analyzeUsability(tools: Tool[]): UsabilityMetrics {
    const toolNamingConvention = this.analyzeNamingConvention(tools);
    const parameterClarity = this.analyzeParameterClarity(tools);
    const hasHelpfulDescriptions = this.checkDescriptions(tools);
    const followsBestPractices = this.checkBestPractices(tools);

    // Generate detailed analysis for tool-by-tool breakdown
    const detailedAnalysis = this.generateDetailedAnalysis(tools);

    return {
      toolNamingConvention,
      parameterClarity,
      hasHelpfulDescriptions,
      followsBestPractices,
      detailedAnalysis,
    };
  }

  private generateDetailedAnalysis(tools: Tool[]) {
    const toolAnalysis = tools.map(tool => {
      const schema = this.getToolSchema(tool);
      const namingPattern = this.determineNamingPattern(tool.name);
      const hasDescription = !!tool.description;
      const descriptionLength = typeof tool.description === 'string' ? tool.description.length : 0;

      // Count parameters
      const parameterCount = schema?.properties ? Object.keys(schema.properties).length : 0;
      const hasRequiredParams = schema?.required ? (schema.required as any[]).length > 0 : false;

      // Assess schema quality
      const hasSchema = !!schema;
      const schemaQuality = this.assessSchemaQuality(schema);

      return {
        toolName: tool.name,
        namingPattern,
        description: tool.description,
        descriptionLength,
        hasDescription,
        parameterCount,
        hasRequiredParams,
        hasSchema,
        schemaQuality,
      };
    });

    // Calculate scores for each category (out of 25 points each)
    const namingScore = this.calculateNamingScore(tools);
    const descriptionScore = this.calculateDescriptionScore(tools);
    const schemaScore = this.calculateSchemaScore(tools);
    const clarityScore = this.calculateClarityScore(tools);

    const bestPracticeScore = {
      naming: namingScore,
      descriptions: descriptionScore,
      schemas: schemaScore,
      clarity: clarityScore,
      total: namingScore + descriptionScore + schemaScore + clarityScore,
    };

    // Overall score out of 100
    const overallScore = bestPracticeScore.total;

    // Generate the required structure for detailedAnalysis
    const namingPatterns = this.analyzeNamingPatterns(tools);
    const parameterIssues = this.identifyParameterIssues(tools);

    return {
      tools: toolAnalysis,
      naming: {
        patterns: Object.keys(namingPatterns),
        breakdown: namingPatterns,
        dominant: Object.entries(namingPatterns).reduce((a, b) => (namingPatterns as any)[a[0]] > (namingPatterns as any)[b[0]] ? a : b)[0]
      },
      descriptions: {
        withDescriptions: tools.filter(t => typeof t.description === 'string' && t.description.length > 10).length,
        withoutDescriptions: tools.filter(t => !t.description || typeof t.description !== 'string' || t.description.length <= 10).length,
        averageLength: tools.reduce((sum, t) => sum + (typeof t.description === 'string' ? t.description.length : 0), 0) / tools.length,
        tooShort: [],
        adequate: [],
        detailed: []
      },
      namingPatterns,
      parameterIssues,
      bestPracticeScore,
      overallScore,
    };
  }

  private determineNamingPattern(name: string): string {
    if (/^[a-z][a-zA-Z0-9]*$/.test(name)) return "camelCase";
    if (/^[a-z]+(_[a-z]+)*$/.test(name)) return "snake_case";
    if (/^[a-z]+(-[a-z]+)*$/.test(name)) return "kebab-case";
    if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return "PascalCase";
    return "mixed";
  }

  private assessSchemaQuality(schema: any): string {
    if (!schema) return "missing";
    if (!schema.properties) return "poor";

    const hasDescriptions = Object.values(schema.properties).some((prop: any) => prop.description);
    const hasTypes = Object.values(schema.properties).every((prop: any) => prop.type);

    if (hasDescriptions && hasTypes) return "excellent";
    if (hasTypes) return "good";
    return "poor";
  }

  private calculateNamingScore(tools: Tool[]): number {
    if (tools.length === 0) return 25;

    const convention = this.analyzeNamingConvention(tools);
    return convention === "consistent" ? 25 : 15;
  }

  private calculateDescriptionScore(tools: Tool[]): number {
    if (tools.length === 0) return 25;

    let score = 0;
    for (const tool of tools) {
      if (tool.description && tool.description.length >= 20) {
        score += 25 / tools.length;
      } else if (tool.description && tool.description.length >= 10) {
        score += 15 / tools.length;
      } else if (tool.description) {
        score += 5 / tools.length;
      }
    }
    return Math.round(score);
  }

  private calculateSchemaScore(tools: Tool[]): number {
    if (tools.length === 0) return 25;

    let score = 0;
    for (const tool of tools) {
      const schema = this.getToolSchema(tool);
      if (schema?.properties) {
        score += 25 / tools.length;
      } else if (schema) {
        score += 10 / tools.length;
      }
    }
    return Math.round(score);
  }

  private calculateClarityScore(tools: Tool[]): number {
    if (tools.length === 0) return 25;

    const clarity = this.analyzeParameterClarity(tools);
    if (clarity === "clear") return 25;
    if (clarity === "mixed") return 15;
    return 5;
  }

  private analyzeNamingPatterns(tools: Tool[]) {
    const patterns = { camelCase: 0, snake_case: 0, "kebab-case": 0, PascalCase: 0, mixed: 0 };

    for (const tool of tools) {
      const pattern = this.determineNamingPattern(tool.name);
      patterns[pattern as keyof typeof patterns]++;
    }

    return patterns;
  }

  private identifyParameterIssues(tools: Tool[]): string[] {
    const issues: string[] = [];

    for (const tool of tools) {
      const schema = this.getToolSchema(tool);
      if (!schema) {
        issues.push(`${tool.name}: Missing schema`);
        continue;
      }

      if (!schema.properties) {
        issues.push(`${tool.name}: Schema has no properties defined`);
        continue;
      }

      for (const [paramName, paramDef] of Object.entries(schema.properties as Record<string, any>)) {
        if (!paramDef.description) {
          issues.push(`${tool.name}: Parameter '${paramName}' lacks description`);
        }
        if (!paramDef.type) {
          issues.push(`${tool.name}: Parameter '${paramName}' lacks type definition`);
        }
      }
    }

    return issues;
  }

  private analyzeNamingConvention(tools: Tool[]): "consistent" | "inconsistent" {
    if (tools.length === 0) return "consistent";

    const namingPatterns = {
      camelCase: 0,
      snake_case: 0,
      kebab_case: 0,
      PascalCase: 0,
    };

    for (const tool of tools) {
      const name = tool.name;

      if (/^[a-z][a-zA-Z0-9]*$/.test(name)) {
        namingPatterns.camelCase++;
      } else if (/^[a-z]+(_[a-z]+)*$/.test(name)) {
        namingPatterns.snake_case++;
      } else if (/^[a-z]+(-[a-z]+)*$/.test(name)) {
        namingPatterns.kebab_case++;
      } else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
        namingPatterns.PascalCase++;
      }
    }

    // Check if one pattern dominates (>70%)
    const total = tools.length;
    const threshold = total * 0.7;

    for (const count of Object.values(namingPatterns)) {
      if (count >= threshold) {
        return "consistent";
      }
    }

    return "inconsistent";
  }

  private analyzeParameterClarity(tools: Tool[]): "clear" | "unclear" | "mixed" {
    if (tools.length === 0) return "clear";

    let clearCount = 0;
    let unclearCount = 0;

    for (const tool of tools) {
      const schema = this.getToolSchema(tool);

      if (!schema?.properties) continue;

      for (const [paramName, paramDef] of Object.entries(
        schema.properties as Record<string, JSONObject>,
      )) {
        // Check if parameter name is self-descriptive
        if (this.isDescriptiveName(paramName)) {
          clearCount++;
        } else {
          unclearCount++;
        }

        // Check if parameter has description
        if (paramDef.description) {
          clearCount++;
        } else {
          unclearCount++;
        }
      }
    }

    const total = clearCount + unclearCount;
    if (total === 0) return "clear";

    const clarityRatio = clearCount / total;

    if (clarityRatio >= 0.8) return "clear";
    if (clarityRatio <= 0.3) return "unclear";
    return "mixed";
  }

  private checkDescriptions(tools: Tool[]): boolean {
    if (tools.length === 0) return false;

    let toolsWithDescriptions = 0;

    for (const tool of tools) {
      if (tool.description && tool.description.length > 10) {
        toolsWithDescriptions++;
      }
    }

    // Consider helpful if >70% of tools have descriptions
    return toolsWithDescriptions / tools.length >= 0.7;
  }

  private checkBestPractices(tools: Tool[]): boolean {
    const practices = {
      hasVersioning: false,
      hasErrorHandling: false,
      hasValidation: false,
      hasDocumentation: false,
    };

    // Check various best practices
    for (const tool of tools) {
      const schema = this.getToolSchema(tool) as any;

      // Check for validation (required fields, enums, etc.)
      if (schema?.required && schema.required.length > 0) {
        practices.hasValidation = true;
      }

      // Check for proper parameter constraints
      if (schema?.properties) {
        for (const prop of Object.values(
          schema.properties as Record<string, JSONObject>,
        )) {
          if (
            prop.enum ||
            prop.minimum !== undefined ||
            prop.maximum !== undefined
          ) {
            practices.hasValidation = true;
          }
        }
      }

      // Check for documentation
      if (tool.description) {
        practices.hasDocumentation = true;
      }
    }

    // Count how many practices are followed
    const followedPractices = Object.values(practices).filter((v) => v).length;

    // Consider following best practices if at least 2 are met
    return followedPractices >= 2;
  }

  private isDescriptiveName(name: string): boolean {
    // Check if name is self-descriptive
    const goodNames = [
      "query",
      "search",
      "input",
      "output",
      "data",
      "content",
      "message",
      "text",
      "file",
      "path",
      "url",
      "name",
      "id",
      "value",
      "result",
      "response",
      "request",
      "params",
    ];

    const nameLower = name.toLowerCase();

    // Check if name contains any good keywords
    for (const goodName of goodNames) {
      if (nameLower.includes(goodName)) {
        return true;
      }
    }

    // Check if name is not too short or cryptic
    return name.length > 3 && !/^[a-z]$/.test(name);
  }

  private getToolSchema(tool: Tool): JSONObject | null {
    if (!tool.inputSchema) return null;

    return typeof tool.inputSchema === "string"
      ? (this.safeJsonParse(tool.inputSchema) as JSONObject)
      : (tool.inputSchema as JSONObject);
  }

  private determineUsabilityStatus(
    metrics: UsabilityMetrics,
  ): AssessmentStatus {
    let score = 0;
    const maxScore = 4;

    if (metrics.toolNamingConvention === "consistent") score++;
    if (metrics.parameterClarity === "clear") score++;
    if (metrics.hasHelpfulDescriptions) score++;
    if (metrics.followsBestPractices) score++;

    const percentage = (score / maxScore) * 100;

    if (percentage >= 75) return "PASS";
    if (percentage >= 50) return "NEED_MORE_INFO";
    return "FAIL";
  }

  private generateExplanation(metrics: UsabilityMetrics, tools: Tool[]): string {
    const parts: string[] = [];

    parts.push(`Analyzed ${tools.length} tools for usability.`);

    parts.push(`Naming convention: ${metrics.toolNamingConvention}.`);
    parts.push(`Parameter clarity: ${metrics.parameterClarity}.`);

    const features: string[] = [];
    if (metrics.hasHelpfulDescriptions) features.push("helpful descriptions");
    if (metrics.followsBestPractices) features.push("follows best practices");

    if (features.length > 0) {
      parts.push(`Features: ${features.join(", ")}.`);
    } else {
      parts.push("Missing key usability features.");
    }

    return parts.join(" ");
  }

  private generateRecommendations(metrics: UsabilityMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.toolNamingConvention === "inconsistent") {
      recommendations.push(
        "Adopt a consistent naming convention for all tools",
      );
    }

    if (metrics.parameterClarity !== "clear") {
      recommendations.push("Use descriptive parameter names");
      recommendations.push("Add descriptions for all parameters");
    }

    if (!metrics.hasHelpfulDescriptions) {
      recommendations.push("Provide detailed descriptions for each tool");
    }

    if (!metrics.followsBestPractices) {
      recommendations.push("Implement input validation with constraints");
      recommendations.push("Follow MCP best practices for tool design");
    }

    return recommendations;
  }
}
