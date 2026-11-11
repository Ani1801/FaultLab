import { apiClient } from './apiClient';
import type {
  DiagnosticReport,
  DiagnosticListItem,
  DiagnosticSummary,
  PaginationMeta,
} from '../types/diagnostic';

export interface ListDiagnosticsParams {
  overallStatus?: 'HEALTHY' | 'WARNING' | 'CRITICAL_ISSUES';
  page?: number;
  limit?: number;
}

export class DiagnosticService {
  /**
   * Retrieves the diagnostic report for a specific test run.
   */
  async getDiagnosticByRunId(runId: string): Promise<DiagnosticReport | null> {
    try {
      const res = await apiClient.get<{ status: string; diagnostic: DiagnosticReport }>(
        `/api-test-runs/${runId}/diagnostics`
      );
      return res.diagnostic;
    } catch (err: any) {
      if (err?.status === 404 || err?.response?.status === 404) return null;
      throw err;
    }
  }

  /**
   * Lists diagnostic reports for a project with optional filtering and pagination.
   */
  async listProjectDiagnostics(
    projectId: string,
    params: ListDiagnosticsParams = {}
  ): Promise<{ diagnostics: DiagnosticListItem[]; pagination: PaginationMeta }> {
    const query = new URLSearchParams();
    if (params.overallStatus) query.set('overallStatus', params.overallStatus);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const url = `/projects/${projectId}/diagnostics${qs ? `?${qs}` : ''}`;

    const res = await apiClient.get<{
      status: string;
      diagnostics: DiagnosticListItem[];
      pagination: PaginationMeta;
    }>(url);

    return { diagnostics: res.diagnostics, pagination: res.pagination };
  }

  /**
   * Returns aggregated diagnostic statistics for a project.
   */
  async getProjectDiagnosticSummary(projectId: string): Promise<DiagnosticSummary> {
    const res = await apiClient.get<{ status: string; summary: DiagnosticSummary }>(
      `/projects/${projectId}/diagnostics/summary`
    );
    return res.summary;
  }
}

export const diagnosticService = new DiagnosticService();

