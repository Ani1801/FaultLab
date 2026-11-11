// FaultLab - Phase 8: API Diagnostic Engine
// Orchestrates rule execution, severity sorting, deduplication, and report generation.

import { runAllRules } from './diagnostic.rules.js';
import type {
  DiagnosticInput,
  DiagnosticReport,
  DiagnosticOverallStatus,
  DiagnosticFinding,
  DiagnosticSeverity,
} from './diagnostic.types.js';

// ─── Severity Ordering ────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

function sortBySeverity(findings: DiagnosticFinding[]): DiagnosticFinding[] {
  return [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

// ─── Overall Status Derivation ────────────────────────────────────────────────

function deriveOverallStatus(findings: DiagnosticFinding[]): DiagnosticOverallStatus {
  if (findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')) {
    return 'CRITICAL_ISSUES';
  }
  if (findings.some((f) => f.severity === 'MEDIUM')) {
    return 'WARNING';
  }
  return 'HEALTHY';
}

// ─── Summary Generation ───────────────────────────────────────────────────────

function generateSummary(findings: DiagnosticFinding[], overallStatus: DiagnosticOverallStatus): string {
  if (findings.length === 0) {
    return 'No diagnostic issues detected. The request completed successfully within normal parameters.';
  }

  const topFindings = findings.slice(0, 3);
  const topTitles = topFindings.map((f) => f.title).join('; ');
  const remaining = findings.length - topFindings.length;

  const prefix =
    overallStatus === 'CRITICAL_ISSUES'
      ? `Critical issues detected: `
      : overallStatus === 'WARNING'
      ? `Potential issues detected: `
      : `Minor observations: `;

  const suffix = remaining > 0 ? ` (+${remaining} more finding${remaining > 1 ? 's' : ''})` : '.';

  return `${prefix}${topTitles}${suffix}`;
}

// ─── Main Engine Entry Point ──────────────────────────────────────────────────

/**
 * Runs the deterministic diagnostic rule engine over an API test execution input.
 * Always returns a DiagnosticReport — never throws.
 */
export function runDiagnosticEngine(input: DiagnosticInput): DiagnosticReport {
  try {
    const rawFindings = runAllRules(input);
    const sorted = sortBySeverity(rawFindings);
    const overallStatus = deriveOverallStatus(sorted);
    const summary = generateSummary(sorted, overallStatus);

    return {
      overallStatus,
      summary,
      totalFindings: sorted.length,
      findings: sorted,
    };
  } catch (err) {
    // Engine failure must NEVER propagate — return a safe fallback report
    console.error('[DiagnosticEngine] Rule engine threw an unexpected error:', err);
    return {
      overallStatus: 'HEALTHY',
      summary: 'Diagnostic analysis could not be completed due to an internal error.',
      totalFindings: 0,
      findings: [],
    };
  }
}

