// FaultLab - Phase 8: Diagnostic Types (Frontend)

export type DiagnosticSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type DiagnosticCategory =
  | 'HTTP_STATUS'
  | 'AUTHENTICATION'
  | 'REQUEST_CONFIG'
  | 'RESPONSE'
  | 'NETWORK'
  | 'PERFORMANCE'
  | 'ASSERTION';

export type DiagnosticConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type DiagnosticOverallStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL_ISSUES';

export interface DiagnosticFinding {
  code: string;
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
  title: string;
  explanation: string;
  evidence: string;
  probableCause: string;
  recommendedActions: string[];
  confidence: DiagnosticConfidence;
}

export interface DiagnosticReport {
  overallStatus: DiagnosticOverallStatus;
  summary: string;
  totalFindings: number;
  findings: DiagnosticFinding[];
}

export interface DiagnosticListItem {
  id: string;
  apiTestRunId: string | null;
  overallStatus: DiagnosticOverallStatus;
  summary: string;
  totalFindings: number;
  createdAt: string;
}

export interface DiagnosticSummary {
  total: number;
  healthy: number;
  warning: number;
  criticalIssues: number;
  lastRunAt: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

