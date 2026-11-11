// FaultLab - Phase 8: Diagnostic Controller

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { diagnosticService } from './diagnostic.service.js';
import {
  runIdParamSchema,
  projectIdParamSchema,
  listDiagnosticsQuerySchema,
} from './diagnostic.schemas.js';

export class DiagnosticController {
  /**
   * GET /api/v1/api-test-runs/:runId/diagnostics
   * Retrieves the diagnostic report for a specific test run.
   */
  async getDiagnosticByRunId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { runId } = runIdParamSchema.parse(req.params);
      const userId = req.user!.id;

      const report = await diagnosticService.getDiagnosticByRunId(userId, runId);

      if (!report) {
        res.status(404).json({
          status: 'error',
          message: 'Diagnostic report not found for this test run',
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        diagnostic: report,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: error.errors[0]?.message || 'Validation error',
          errors: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * GET /api/v1/projects/:projectId/diagnostics
   * Lists diagnostic reports for a project with optional filtering and pagination.
   */
  async listProjectDiagnostics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = projectIdParamSchema.parse(req.params);
      const { overallStatus, page, limit } = listDiagnosticsQuerySchema.parse(req.query);
      const userId = req.user!.id;

      const result = await diagnosticService.listProjectDiagnostics(userId, projectId, {
        overallStatus,
        page,
        limit,
      });

      res.status(200).json({
        status: 'success',
        ...result,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: error.errors[0]?.message || 'Validation error',
          errors: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * GET /api/v1/projects/:projectId/diagnostics/summary
   * Returns aggregated diagnostic statistics for a project.
   */
  async getProjectDiagnosticSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = projectIdParamSchema.parse(req.params);
      const userId = req.user!.id;

      const summary = await diagnosticService.getProjectDiagnosticSummary(userId, projectId);

      res.status(200).json({
        status: 'success',
        summary,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: error.errors[0]?.message || 'Validation error',
          errors: error.errors,
        });
        return;
      }
      next(error);
    }
  }
}

export const diagnosticController = new DiagnosticController();

