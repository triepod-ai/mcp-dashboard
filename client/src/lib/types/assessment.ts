/**
 * Comprehensive TypeScript types for MCP Assessment System
 * Replaces all 'any' types with proper typed interfaces
 */

// Package.json and dependency types
export interface PackageJson {
  name: string;
  version: string;
  description?: string;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  repository?: {
    type: string;
    url: string;
  };
  author?: string | { name: string; email?: string; url?: string };
  license?: string;
  bugs?: { url: string };
  homepage?: string;
  keywords?: string[];
  [key: string]: unknown;
}

export interface PackageLock {
  name: string;
  version: string;
  lockfileVersion: number;
  requires?: boolean;
  packages?: Record<
    string,
    {
      version?: string;
      resolved?: string;
      integrity?: string;
      dev?: boolean;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      [key: string]: unknown;
    }
  >;
  dependencies?: Record<
    string,
    {
      version: string;
      resolved?: string;
      integrity?: string;
      dev?: boolean;
      requires?: Record<string, string>;
      dependencies?: Record<string, unknown>;
      [key: string]: unknown;
    }
  >;
  [key: string]: unknown;
}

// Privacy and compliance types
export interface PrivacyPolicy {
  dataCollection?: {
    types: string[];
    purposes: string[];
    retention: string;
  };
  dataSharing?: {
    thirdParties: string[];
    purposes: string[];
    userConsent: boolean;
  };
  userRights?: {
    access: boolean;
    rectification: boolean;
    erasure: boolean;
    portability: boolean;
  };
  contact?: {
    email?: string;
    address?: string;
    phone?: string;
  };
  lastUpdated?: string;
  jurisdiction?: string;
  [key: string]: unknown;
}

export interface DataRetentionInfo {
  period: string;
  criteria: string;
  automaticDeletion: boolean;
  userControlled: boolean;
  [key: string]: unknown;
}

export interface EncryptionInfo {
  inTransit: {
    enabled: boolean;
    protocol?: string;
    strength?: string;
  };
  atRest: {
    enabled: boolean;
    algorithm?: string;
    keyManagement?: string;
  };
  [key: string]: unknown;
}

export interface DataTransferInfo {
  crossBorder: boolean;
  safeguards?: string[];
  adequacyDecision?: boolean;
  userConsent?: boolean;
  [key: string]: unknown;
}

export interface ConsentInfo {
  required: boolean;
  granular: boolean;
  withdrawable: boolean;
  mechanism: string;
  [key: string]: unknown;
}

export interface COPPACompliance {
  applicable: boolean;
  parentalConsent?: boolean;
  dataMinimization?: boolean;
  safeHarbor?: boolean;
  [key: string]: unknown;
}

export interface DataSubjectRights {
  access: boolean;
  rectification: boolean;
  erasure: boolean;
  restriction: boolean;
  portability: boolean;
  objection: boolean;
  [key: string]: unknown;
}

export interface JurisdictionInfo {
  primary: string;
  applicable: string[];
  conflictResolution?: string;
  [key: string]: unknown;
}

// Server metadata types
export interface ServerMetadata {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  license?: string;
  repository?: string;
  homepage?: string;
  tags?: string[];
  category?: string;
  capabilities?: string[];
  requirements?: string[];
  [key: string]: unknown;
}

// Tool execution and WebSocket types
export interface ToolExecutionRequest {
  tool: string;
  parameters: Record<string, unknown>;
  timeout?: number;
  retries?: number;
}

export interface ToolExecutionResponse {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime?: number;
  metadata?: Record<string, unknown>;
}

export interface WebSocketMessage {
  type: string;
  data: unknown;
  id?: string;
  timestamp?: number;
}

export interface WebSocketError {
  code: number;
  message: string;
  details?: unknown;
}

// Assessment scoring types
export interface ScoreCalculation {
  raw: number;
  weighted: number;
  factor: number;
  category: string;
  description: string;
}

export interface AssessmentMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  executionTime: number;
  coverage: number;
  reliability: number;
}

// Vulnerability and security types
export interface SecurityVulnerability {
  id: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  type: string;
  description: string;
  affected: string[];
  fixed?: string;
  references?: string[];
  cvss?: number;
}

export interface SecurityScanResult {
  vulnerabilities: SecurityVulnerability[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  scanDate: string;
  scannerVersion?: string;
}

// SBOM (Software Bill of Materials) types
export interface SBOMComponent {
  name: string;
  version: string;
  type: "library" | "framework" | "application" | "container" | "file";
  supplier?: string;
  downloadLocation?: string;
  filesAnalyzed?: boolean;
  licenseConcluded?: string;
  licenseDeclared?: string;
  copyrightText?: string;
  [key: string]: unknown;
}

export interface SBOM {
  spdxVersion: string;
  dataLicense: string;
  spdxId: string;
  name: string;
  documentNamespace: string;
  creators: string[];
  created: string;
  packages: SBOMComponent[];
  relationships?: Array<{
    spdxElementId: string;
    relationshipType: string;
    relatedSpdxElement: string;
  }>;
  [key: string]: unknown;
}

// Event and SSE types
export interface ServerEvent {
  type: string;
  data: unknown;
  timestamp: number;
  source?: string;
}

export interface SSEConnection {
  connected: boolean;
  lastEvent?: Date;
  reconnectAttempts: number;
  error?: string;
}

// Generic utility types for common patterns
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONObject
  | JSONArray;
export interface JSONObject {
  [key: string]: JSONValue;
}
export type JSONArray = Array<JSONValue>;

// Response wrapper type for API calls
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
  requestId?: string;
}

// Generic error type
export interface AssessmentError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: number;
  source?: string;
}
