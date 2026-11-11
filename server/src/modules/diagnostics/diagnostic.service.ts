// FaultLab - Phase 8: API Diagnostic Service
// Persists and retrieves diagnostic reports; integrates with Prisma.

import { prisma } from '../../utils/prisma.js';
import { runDiagnosticEngine } from './diagnostic.engine.js';
import type { DiagnosticInput, DiagnosticReport } from './diagnostic.types.js';

export interface GenerateAndPersistParams {
  apiTestRunId: string;
  projectId: string;
  input: DiagnosticInput;
}

export interface ProjectDiagnosticFilters {
  overallStatus?: 'HEALTHY' | 'WARNING' | 'CRITICAL_ISSUES';
  page?: number;
  limit?: number;
}

export class DiagnosticService {
  /**
   * Runs the diagnostic engine and upserts the report for the given test run.
   * Uses upsert to prevent duplicates if called more than once per run.
   * Never throws — a failure here must NOT crash the test execution flow.
   */
  async generateAndPersistDiagnostic(params: GenerateAndPersistParams): Promise<DiagnosticReport | null> {
    try {
      const report = runDiagnosticEngine(params.input);

      await prisma.apiDiagnosticReport.upsert({
        where: { apiTestRunId: params.apiTestRunId },
        create: {
          projectId: params.projectId,
          apiTestRunId: params.apiTestRunId,
          overallStatus: report.overallStatus as any,
          summary: report.summary,
          totalFindings: report.totalFindings,
          findings: report.findings as any,
        },
        update: {
          overallStatus: report.overallStatus as any,
          summary: report.summary,
          totalFindings: report.totalFindings,
          findings: report.findings as any,
        },
      });

      return report;
    } catch (err) {
      console.error('[DiagnosticService] Failed to generate or persist diagnostic report:', err);
      return null;
    }
  }

  /**
   * Runs the diagnostic engine for an ephemeral (unsaved) test run.
   * Returns the report without persisting to the database.
   */
  generateEphemeralDiagnostic(input: DiagnosticInput): DiagnosticReport {
    return runDiagnosticEngine(input);
  }

  /**
   * Retrieves a persisted diagnostic report for a specific test run.
   * Verifies ownership through project → workspace chain.
   */
  async getDiagnosticByRunId(userId: string, runId: string): Promise<DiagnosticReport | null> {
    const report = await prisma.apiDiagnosticReport.findFirst({
      where: {
        apiTestRunId: runId,
        project: {
          workspace: {
            ownerId: userId,
          },
        },
      },
    });

    if (!report) return null;

    return {
      overallStatus: report.overallStatus as any,
      summary: report.summary,
      totalFindings: report.totalFindings,
      findings: report.findings as any,
    };
  }

  /**
   * Lists diagnostic reports for a project with pagination and optional status filter.
   * Verifies ownership through workspace chain.
   */
  async listProjectDiagnostics(
    userId: string,
    projectId: string,
    filters: ProjectDiagnosticFilters = {}
  ): Promise<{
    diagnostics: Array<{
      id: string;
      apiTestRunId: string | null;
      overallStatus: string;
      summary: string;
      totalFindings: number;
      createdAt: Date;
    }>;
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: { ownerId: userId },
      },
    });

    if (!project) {
      const error = new Error('Project not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = { projectId };
    if (filters.overallStatus) {
      where.overallStatus = filters.overallStatus;
    }

    const [totalCount, diagnostics] = await Promise.all([
      prisma.apiDiagnosticReport.count({ where }),
      prisma.apiDiagnosticReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          apiTestRunId: true,
          overallStatus: true,
          summary: true,
          totalFindings: true,
          createdAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    return {
      diagnostics,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Returns aggregated diagnostic statistics for a project.
   * Used to populate the project diagnostics overview panel.
   */
  async getProjectDiagnosticSummary(userId: string, projectId: string): Promise<{
    total: number;
    healthy: number;
    warning: number;
    criticalIssues: number;
    lastRunAt: Date | null;
  }> {
    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: { ownerId: userId },
      },
    });

    if (!project) {
      const error = new Error('Project not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const [total, healthy, warning, criticalIssues, latest] = await Promise.all([
      prisma.apiDiagnosticReport.count({ where: { projectId } }),
      prisma.apiDiagnosticReport.count({ where: { projectId, overallStatus: 'HEALTHY' } }),
      prisma.apiDiagnosticReport.count({ where: { projectId, overallStatus: 'WARNING' } }),
      prisma.apiDiagnosticReport.count({ where: { projectId, overallStatus: 'CRITICAL_ISSUES' } }),
      prisma.apiDiagnosticReport.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      total,
      healthy,
      warning,
      criticalIssues,
      lastRunAt: latest?.createdAt || null,
    };
  }
}

export const diagnosticService = new DiagnosticService();

