// FaultLab - Phase 8: API Diagnostic Engine Types
// Deterministic, rule-based diagnostic classification types

import type { AssertionResultItem } from '../api-testing/assertion.engine.js';

// ─── Enumerations ─────────────────────────────────────────────────────────────

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

// ─── Individual Finding ───────────────────────────────────────────────────────

export interface DiagnosticFinding {
  /** Unique rule code, e.g. HTTP_404, AUTH_001, NET_002 */
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

// ─── Full Diagnostic Report ───────────────────────────────────────────────────

export interface DiagnosticReport {
  overallStatus: DiagnosticOverallStatus;
  summary: string;
  totalFindings: number;
  findings: DiagnosticFinding[];
}

// ─── Engine Input ─────────────────────────────────────────────────────────────

export interface DiagnosticInput {
  /** HTTP method used */
  method: string;
  /** URL that was requested (do not include secrets in query string) */
  url: string;
  /** Authentication type (safe enum value only — never credentials) */
  authenticationType: string;
  /** Was there an execution-level error (network/SSRF/timeout, no HTTP response received) */
  isExecutionError: boolean;
  /** HTTP status code received, or null if execution error */
  statusCode: number | null;
  /** Round-trip response time in ms */
  responseTime: number;
  /** Response headers (pre-sanitized by http.executor) */
  responseHeaders: Record<string, string>;
  /** Sanitized response body (max 65 KB) */
  sanitizedResponseBody: string | null;
  /** Error message from http.executor, if any */
  errorMessage: string | null;
  /** Results of assertion evaluation from assertion.engine */
  assertionResults: AssertionResultItem[];
  /** User-configured maximum response time threshold in ms, if set */
  maxResponseTime: number | null;
  /** User-configured expected HTTP status code, if set */
  expectedStatusCode: number | null;
  /** Timeout used for the request in ms */
  timeoutMs: number;
}

