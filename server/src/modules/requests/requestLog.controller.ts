import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { requestLogService } from './requestLog.service.js';
import {
  projectIdParamSchema,
  requestDetailParamSchema,
  listRequestLogsQuerySchema,
  analyticsQuerySchema,
} from './requestLog.schemas.js';

export class RequestLogController {
  /**
   * GET /api/v1/projects/:projectId/requests
   * Retrieves paginated, filterable request logs for a project.
   */
  async listRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = projectIdParamSchema.parse(req.params);
      const query = listRequestLogsQuerySchema.parse(req.query);
      const userId = req.user!.id;

      const result = await requestLogService.listRequests(userId, projectId, query);

      res.status(200).json(result);
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
   * GET /api/v1/projects/:projectId/requests/:requestId
   * Retrieves details of a specific request log.
   */
  async getRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId, requestId } = requestDetailParamSchema.parse(req.params);
      const userId = req.user!.id;

      const log = await requestLogService.getRequest(userId, projectId, requestId);

      res.status(200).json({
        status: 'success',
        data: log,
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
   * GET /api/v1/projects/:projectId/analytics
   * Retrieves aggregated analytics and performance statistics.
   */
  async getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = projectIdParamSchema.parse(req.params);
      const { timeRange } = analyticsQuerySchema.parse(req.query);
      const userId = req.user!.id;

      const analytics = await requestLogService.getAnalytics(userId, projectId, timeRange);

      res.status(200).json({
        status: 'success',
        analytics,
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

export const requestLogController = new RequestLogController();
