import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { apiTestService } from './apiTest.service.js';
import {
  projectIdParamSchema,
  testIdParamSchema,
  testRunIdParamSchema,
  createApiTestSchema,
  updateApiTestSchema,
  executeUnsavedTestSchema,
  listTestRunsQuerySchema,
} from './apiTest.schemas.js';

export class ApiTestController {
  /**
   * POST /api/v1/projects/:projectId/api-tests
   */
  async createApiTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = projectIdParamSchema.parse(req.params);
      const parsedBody = createApiTestSchema.parse(req.body);
      const userId = req.user!.id;

      const test = await apiTestService.createApiTest(userId, projectId, parsedBody as any);

      res.status(201).json({
        status: 'success',
        message: 'API test created successfully',
        test,
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
   * GET /api/v1/projects/:projectId/api-tests
   */
  async listApiTests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = projectIdParamSchema.parse(req.params);
      const userId = req.user!.id;

      const tests = await apiTestService.listApiTests(userId, projectId);

      res.status(200).json({
        status: 'success',
        tests,
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
   * GET /api/v1/api-tests/:id
   */
  async getApiTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = testIdParamSchema.parse(req.params);
      const userId = req.user!.id;

      const test = await apiTestService.getApiTest(userId, id);

      res.status(200).json({
        status: 'success',
        test,
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
   * PATCH /api/v1/api-tests/:id
   */
  async updateApiTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = testIdParamSchema.parse(req.params);
      const parsedBody = updateApiTestSchema.parse(req.body);
      const userId = req.user!.id;

      const test = await apiTestService.updateApiTest(userId, id, parsedBody as any);

      res.status(200).json({
        status: 'success',
        message: 'API test updated successfully',
        test,
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
   * DELETE /api/v1/api-tests/:id
   */
  async deleteApiTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = testIdParamSchema.parse(req.params);
      const userId = req.user!.id;

      await apiTestService.deleteApiTest(userId, id);

      res.status(200).json({
        status: 'success',
        message: 'API test deleted successfully',
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
   * POST /api/v1/api-tests/:id/run
   */
  async runApiTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = testIdParamSchema.parse(req.params);
      const userId = req.user!.id;

      const result = await apiTestService.runApiTest(userId, id);

      res.status(200).json({
        status: 'success',
        test: result.test,
        run: result.run,
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
   * POST /api/v1/projects/:projectId/api-tests/execute
   */
  async executeUnsavedTest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = projectIdParamSchema.parse(req.params);
      const parsedBody = executeUnsavedTestSchema.parse(req.body);
      const userId = req.user!.id;

      const run = await apiTestService.executeUnsavedTest(userId, projectId, parsedBody as any);

      res.status(200).json({
        status: 'success',
        run,
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
   * GET /api/v1/api-tests/:id/runs
   */
  async listTestRuns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = testIdParamSchema.parse(req.params);
      const { page, limit } = listTestRunsQuerySchema.parse(req.query);
      const userId = req.user!.id;

      const result = await apiTestService.listTestRuns(userId, id, page, limit);

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
   * GET /api/v1/api-test-runs/:runId
   */
  async getTestRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { runId } = testRunIdParamSchema.parse(req.params);
      const userId = req.user!.id;

      const run = await apiTestService.getTestRun(userId, runId);

      res.status(200).json({
        status: 'success',
        run,
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

export const apiTestController = new ApiTestController();

