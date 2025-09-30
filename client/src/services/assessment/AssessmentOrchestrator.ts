/**
 * Assessment Orchestrator
 * Coordinates all assessment modules and manages the assessment workflow
 */

import {
  MCPDirectoryAssessment,
  AssessmentConfiguration,
  AssessmentStatus,
  DEFAULT_ASSESSMENT_CONFIG,
  FunctionalityAssessment,
  SecurityAssessment,
  DynamicSecurityAssessment,
  DocumentationAssessment,
  ErrorHandlingAssessment,
  UsabilityAssessment,
  MCPSpecComplianceAssessment,
} from "@/lib/assessmentTypes";
import {
  Tool,
  CompatibilityCallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { safeGetProperty, isString, isArray } from "@/utils/typeGuards";
import {
  PackageJson,
  PackageLock,
  PrivacyPolicy,
  DataRetentionInfo,
  EncryptionInfo,
  DataTransferInfo,
  ConsentInfo,
  COPPACompliance,
  DataSubjectRights,
  JurisdictionInfo,
  ServerMetadata,
  JSONObject,
} from "@/lib/types/assessment";

// Core assessment modules
import { FunctionalityAssessor } from "./modules/FunctionalityAssessor";
import { SecurityAssessor } from "./modules/SecurityAssessor";
import { DocumentationAssessor } from "./modules/DocumentationAssessor";
import { ErrorHandlingAssessor } from "./modules/ErrorHandlingAssessor";
import { UsabilityAssessor } from "./modules/UsabilityAssessor";

// Extended assessment modules
import { MCPSpecComplianceAssessor } from "./modules/MCPSpecComplianceAssessor";
import { DynamicSecurityAssessor } from "./modules/DynamicSecurityAssessor";

export interface AssessmentContext {
  serverName: string;
  tools: Tool[];
  callTool: (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<CompatibilityCallToolResult>;
  readmeContent?: string;
  packageJson?: PackageJson;
  packageLock?: PackageLock;
  privacyPolicy?: PrivacyPolicy;
  config: AssessmentConfiguration;
  serverInfo?: {
    name: string;
    version?: string;
    metadata?: ServerMetadata;
    privacyPolicy?: PrivacyPolicy;
    dataRetention?: DataRetentionInfo;
    encryption?: EncryptionInfo;
    dataTransfer?: DataTransferInfo;
    consent?: ConsentInfo;
    coppaCompliance?: COPPACompliance;
    dataSubjectRights?: DataSubjectRights;
    jurisdiction?: JurisdictionInfo;
    dataLocalization?: JSONObject;
  };
}

export class AssessmentOrchestrator {
  private config: AssessmentConfiguration;
  private startTime: number = 0;
  private totalTestsRun: number = 0;

  // Core assessors
  private functionalityAssessor: FunctionalityAssessor;
  private securityAssessor: SecurityAssessor;
  private documentationAssessor: DocumentationAssessor;
  private errorHandlingAssessor: ErrorHandlingAssessor;
  private usabilityAssessor: UsabilityAssessor;

  // Extended assessors
  private mcpSpecAssessor?: MCPSpecComplianceAssessor;
  private dynamicSecurityAssessor?: DynamicSecurityAssessor;

  constructor(config: Partial<AssessmentConfiguration> = {}) {
    this.config = { ...DEFAULT_ASSESSMENT_CONFIG, ...config };

    // Initialize core assessors
    this.functionalityAssessor = new FunctionalityAssessor(this.config);
    this.securityAssessor = new SecurityAssessor(this.config);
    this.documentationAssessor = new DocumentationAssessor(this.config);
    this.errorHandlingAssessor = new ErrorHandlingAssessor(this.config);
    this.usabilityAssessor = new UsabilityAssessor(this.config);

    // Initialize extended assessors if enabled
    if (this.config.enableExtendedAssessment) {
      if (this.config.assessmentCategories?.mcpSpecCompliance) {
        this.mcpSpecAssessor = new MCPSpecComplianceAssessor(this.config);
      }
      if (this.config.assessmentCategories?.dynamicSecurity) {
        this.dynamicSecurityAssessor = new DynamicSecurityAssessor(this.config);
      }
    }
  }

  /**
   * Run a complete assessment on an MCP server
   */
  async runFullAssessment(
    context: AssessmentContext,
  ): Promise<MCPDirectoryAssessment> {
    this.startTime = Date.now();
    this.totalTestsRun = 0;

    const assessmentResults: Record<string, unknown> = {};

    if (this.config.parallelTesting) {
      // Create assessment tasks with proper batching
      const assessmentTasks: Array<{
        key: string;
        name: string;
        executor: () => Promise<unknown>;
      }> = [];

      // Core assessments - only add enabled ones
      if (this.config.assessmentCategories?.functionality !== false) {
        assessmentTasks.push({
          key: 'functionality',
          name: 'Functionality Assessment',
          executor: () => this.functionalityAssessor.assess(context)
        });
      }

      if (this.config.assessmentCategories?.security !== false) {
        assessmentTasks.push({
          key: 'security',
          name: 'Security Assessment',
          executor: () => this.securityAssessor.assess(context)
        });
      }

      if (this.config.assessmentCategories?.documentation !== false) {
        assessmentTasks.push({
          key: 'documentation',
          name: 'Documentation Assessment',
          executor: () => this.documentationAssessor.assess(context)
        });
      }

      if (this.config.assessmentCategories?.errorHandling !== false) {
        assessmentTasks.push({
          key: 'errorHandling',
          name: 'Error Handling Assessment',
          executor: () => this.errorHandlingAssessor.assess(context)
        });
      }

      if (this.config.assessmentCategories?.usability !== false) {
        assessmentTasks.push({
          key: 'usability',
          name: 'Usability Assessment',
          executor: () => this.usabilityAssessor.assess(context)
        });
      }

      // Extended assessments
      if (this.mcpSpecAssessor) {
        assessmentTasks.push({
          key: 'mcpSpecCompliance',
          name: 'MCP Spec Compliance Assessment',
          executor: () => this.mcpSpecAssessor!.assess(context)
        });
      }
      if (this.dynamicSecurityAssessor) {
        assessmentTasks.push({
          key: 'dynamicSecurity',
          name: 'Dynamic Security Assessment',
          executor: () => this.dynamicSecurityAssessor!.assess(context)
        });
      }

      // Execute assessments in batches respecting maxParallelTests
      await this.executeBatchedAssessments(assessmentTasks, assessmentResults);
    } else {
      // Sequential execution - only run enabled assessments
      if (this.config.assessmentCategories?.functionality !== false) {
        assessmentResults.functionality =
          await this.functionalityAssessor.assess(context);
      }

      if (this.config.assessmentCategories?.security !== false) {
        assessmentResults.security = await this.securityAssessor.assess(context);
      }

      if (this.config.assessmentCategories?.documentation !== false) {
        assessmentResults.documentation =
          await this.documentationAssessor.assess(context);
      }

      if (this.config.assessmentCategories?.errorHandling !== false) {
        assessmentResults.errorHandling =
          await this.errorHandlingAssessor.assess(context);
      }

      if (this.config.assessmentCategories?.usability !== false) {
        assessmentResults.usability =
          await this.usabilityAssessor.assess(context);
      }

      if (this.mcpSpecAssessor) {
        assessmentResults.mcpSpecCompliance =
          await this.mcpSpecAssessor.assess(context);
      }
      if (this.dynamicSecurityAssessor) {
        assessmentResults.dynamicSecurity =
          await this.dynamicSecurityAssessor.assess(context);
      }
    }

    // Collect test counts from all assessors
    this.totalTestsRun = this.collectTotalTestCount(assessmentResults);

    // Determine overall status
    const overallStatus = this.determineOverallStatus(assessmentResults);

    // Generate summary and recommendations
    const summary = this.generateSummary(assessmentResults);
    const recommendations = this.generateRecommendations(assessmentResults);

    const executionTime = Date.now() - this.startTime;

    // Type the results properly to satisfy MCPDirectoryAssessment interface
    const result: MCPDirectoryAssessment = {
      serverName: context.serverName,
      assessmentDate: new Date().toISOString(),
      assessorVersion: "2.0.0",

      // Core required assessments
      functionality: assessmentResults.functionality as FunctionalityAssessment,
      security: assessmentResults.security as SecurityAssessment,
      documentation: assessmentResults.documentation as DocumentationAssessment,
      errorHandling: assessmentResults.errorHandling as ErrorHandlingAssessment,
      usability: assessmentResults.usability as UsabilityAssessment,

      // Optional extended assessments
      mcpSpecCompliance: assessmentResults.mcpSpecCompliance as MCPSpecComplianceAssessment,
      dynamicSecurity: assessmentResults.dynamicSecurity as DynamicSecurityAssessment,

      // Overall assessment
      overallStatus,
      summary,
      recommendations,
      executionTime,
      totalTestsRun: this.totalTestsRun,
      mcpProtocolVersion: this.config.mcpProtocolVersion,
    };

    return result;
  }

  /**
   * Legacy assess method for backward compatibility
   */
  async assess(
    serverName: string,
    tools: Tool[],
    callTool: (
      name: string,
      params: Record<string, unknown>,
    ) => Promise<CompatibilityCallToolResult>,
    serverInfo?: {
      name: string;
      version?: string;
      metadata?: ServerMetadata;
      privacyPolicy?: PrivacyPolicy;
      dataRetention?: DataRetentionInfo;
      encryption?: EncryptionInfo;
      dataTransfer?: DataTransferInfo;
      consent?: ConsentInfo;
      coppaCompliance?: COPPACompliance;
      dataSubjectRights?: DataSubjectRights;
      jurisdiction?: JurisdictionInfo;
      dataLocalization?: JSONObject;
    },
    readmeContent?: string,
    packageJson?: PackageJson,
  ): Promise<MCPDirectoryAssessment> {
    const context: AssessmentContext = {
      serverName,
      tools,
      callTool,
      readmeContent,
      packageJson,
      serverInfo,
      config: this.config,
    };

    return this.runFullAssessment(context);
  }

  private collectTotalTestCount(results: Record<string, unknown>): number {
    let total = 0;

    // Core assessments - use type guards for safe property access
    const functionalityResults = safeGetProperty(results, "functionality", (v): v is FunctionalityAssessment =>
      v !== null && typeof v === "object" && "toolResults" in v
    );
    if (functionalityResults?.toolResults && isArray(functionalityResults.toolResults)) {
      total += functionalityResults.toolResults.length;
    }

    const securityResults = safeGetProperty(results, "security", (v): v is SecurityAssessment =>
      v !== null && typeof v === "object" && "promptInjectionTests" in v
    );
    if (securityResults?.promptInjectionTests && isArray(securityResults.promptInjectionTests)) {
      total += securityResults.promptInjectionTests.length;
    }

    const errorHandlingResults = safeGetProperty(results, "errorHandling", (v): v is any =>
      v !== null && typeof v === "object" && "metrics" in v
    );
    if (errorHandlingResults?.metrics?.testDetails && isArray(errorHandlingResults.metrics.testDetails)) {
      total += errorHandlingResults.metrics.testDetails.length;
    }

    // Extended assessments
    const dynamicSecurityResults = safeGetProperty(results, "dynamicSecurity", (v): v is DynamicSecurityAssessment =>
      v !== null && typeof v === "object"
    );
    if (dynamicSecurityResults?.runtimeTests && isArray(dynamicSecurityResults.runtimeTests)) {
      total += dynamicSecurityResults.runtimeTests.length;
    }
    if (dynamicSecurityResults?.sandboxTests && isArray(dynamicSecurityResults.sandboxTests)) {
      total += dynamicSecurityResults.sandboxTests.length;
    }

    return total;
  }

  private determineOverallStatus(results: Record<string, unknown>): AssessmentStatus {
    const statuses: AssessmentStatus[] = [];

    // Collect all statuses
    Object.values(results).forEach((assessment: unknown) => {
      const assessmentObj = assessment as { status?: AssessmentStatus };
      if (assessmentObj?.status) {
        statuses.push(assessmentObj.status);
      }
    });

    // If any critical category fails, overall fails
    if (statuses.includes("FAIL")) return "FAIL";

    // If any category needs more info, overall needs more info
    if (statuses.includes("NEED_MORE_INFO")) return "NEED_MORE_INFO";

    // All must pass for overall pass
    return "PASS";
  }

  private generateSummary(results: Record<string, unknown>): string {
    const parts: string[] = [];
    const totalCategories = Object.keys(results).length;
    const passedCategories = Object.values(results).filter(
      (r: unknown) => {
        const assessment = safeGetProperty({ result: r }, "result", (v): v is { status?: string } =>
          v !== null && typeof v === "object" && "status" in v
        );
        return assessment?.status === "PASS";
      }
    ).length;

    parts.push(
      `Assessment complete: ${passedCategories}/${totalCategories} categories passed.`,
    );

    // Add key findings - use type guards for safe access
    const securityResults = safeGetProperty(results, "security", (v): v is SecurityAssessment =>
      v !== null && typeof v === "object" && "vulnerabilities" in v
    );
    if (securityResults?.vulnerabilities && isArray(securityResults.vulnerabilities) && securityResults.vulnerabilities.length > 0) {
      parts.push(
        `Found ${securityResults.vulnerabilities.length} security vulnerabilities.`,
      );
    }

    const functionalityResults = safeGetProperty(results, "functionality", (v): v is FunctionalityAssessment =>
      v !== null && typeof v === "object" && "brokenTools" in v
    );
    if (functionalityResults?.brokenTools && isArray(functionalityResults.brokenTools) && functionalityResults.brokenTools.length > 0) {
      parts.push(
        `${functionalityResults.brokenTools.length} tools are not functioning correctly.`,
      );
    }


    return parts.join(" ");
  }

  /**
   * Execute assessments in parallel with MCP server-optimized throttling
   */
  private async executeBatchedAssessments(
    assessmentTasks: Array<{
      key: string;
      name: string;
      executor: () => Promise<unknown>;
    }>,
    assessmentResults: Record<string, unknown>
  ): Promise<void> {
    // Optimize concurrency for MCP servers - cap at 3 for better reliability
    const maxConcurrency = Math.min(this.config.maxParallelTests || 3, 3);
    const totalTasks = assessmentTasks.length;

    if (this.config.verboseLogging) {
      console.log(`🚀 Starting ${totalTasks} assessments with concurrency: ${maxConcurrency}`);
    }

    type TaskResult =
      | { success: true; key: string; result: unknown; name: string }
      | { success: false; key: string; error: string; name: string };

    // For small numbers of tasks, use simple Promise.all with controlled concurrency
    if (totalTasks <= 3) {
      // Direct parallel execution for small task counts
      const promises = assessmentTasks.map(task =>
        task.executor()
          .then(result => ({ success: true as const, key: task.key, result, name: task.name }))
          .catch(error => ({
            success: false as const,
            key: task.key,
            error: error instanceof Error ? error.message : String(error),
            name: task.name
          }))
      );

      const results = await Promise.allSettled(promises);

      // Process results
      results.forEach((promiseResult, index) => {
        const task = assessmentTasks[index];
        if (promiseResult.status === 'fulfilled') {
          const taskResult = promiseResult.value;
          if (taskResult.success) {
            assessmentResults[taskResult.key] = taskResult.result;
          } else {
            this.handleFailedAssessment(taskResult, assessmentResults);
          }
        } else {
          this.handleRejectedPromise(task, promiseResult.reason, assessmentResults);
        }
      });

      return;
    }

    // For larger task counts, use controlled batching with shorter delays
    let completedTasks = 0;
    for (let i = 0; i < assessmentTasks.length; i += maxConcurrency) {
      const batch = assessmentTasks.slice(i, i + maxConcurrency);

      // Execute batch with simplified promise handling
      const batchPromises = batch.map(task =>
        task.executor()
          .then(result => ({ success: true as const, key: task.key, result, name: task.name }))
          .catch(error => ({
            success: false as const,
            key: task.key,
            error: error instanceof Error ? error.message : String(error),
            name: task.name
          }))
      );

      const batchResults = await Promise.all(batchPromises);

      // Process batch results efficiently
      batchResults.forEach((taskResult: TaskResult) => {
        completedTasks++;
        if (taskResult.success) {
          assessmentResults[taskResult.key] = taskResult.result;
          if (this.config.verboseLogging) {
            console.log(`✅ ${taskResult.name} (${completedTasks}/${totalTasks})`);
          }
        } else {
          this.handleFailedAssessment(taskResult, assessmentResults);
        }
      });

      // Minimal delay between batches to prevent server overload
      if (i + maxConcurrency < assessmentTasks.length) {
        await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 100ms
      }
    }

    if (this.config.verboseLogging) {
      console.log(`🎉 All ${totalTasks} assessments completed`);
    }
  }

  private handleFailedAssessment(
    taskResult: { success: false; key: string; error: string; name: string },
    assessmentResults: Record<string, unknown>
  ): void {
    console.error(`❌ ${taskResult.name} failed: ${taskResult.error}`);
    assessmentResults[taskResult.key] = {
      status: "FAIL" as AssessmentStatus,
      error: taskResult.error,
      summary: `Assessment failed: ${taskResult.error}`
    };
  }

  private handleRejectedPromise(
    task: { key: string; name: string },
    reason: unknown,
    assessmentResults: Record<string, unknown>
  ): void {
    const errorMsg = reason instanceof Error ? reason.message : String(reason);
    console.error(`❌ ${task.name} promise rejected: ${errorMsg}`);
    assessmentResults[task.key] = {
      status: "FAIL" as AssessmentStatus,
      error: errorMsg,
      summary: `Assessment promise rejected`
    };
  }

  private generateRecommendations(results: Record<string, unknown>): string[] {
    const recommendations: string[] = [];

    // Aggregate recommendations from all assessments - use type guards
    Object.values(results).forEach((assessment: unknown) => {
      const assessmentObj = safeGetProperty({ assessment }, "assessment", (v): v is { recommendations?: string[] } =>
        v !== null && typeof v === "object" && "recommendations" in v
      );
      if (assessmentObj?.recommendations && isArray(assessmentObj.recommendations)) {
        // Ensure all items are strings
        const stringRecommendations = assessmentObj.recommendations.filter(isString);
        recommendations.push(...stringRecommendations);
      }
    });

    // De-duplicate and prioritize
    return [...new Set(recommendations)].slice(0, 10);
  }

  /**
   * Get assessment configuration
   */
  getConfig(): AssessmentConfiguration {
    return this.config;
  }

  /**
   * Update assessment configuration
   */
  updateConfig(config: Partial<AssessmentConfiguration>): void {
    this.config = { ...this.config, ...config };
  }
}
