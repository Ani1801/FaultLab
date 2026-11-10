import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { endpointService } from './endpoint.service.js';
import {
  createEndpointSchema,
  updateEndpointSchema,
  projectIdParamSchema,
  endpointIdParamSchema,
} from './endpoint.schemas.js';

export class EndpointController {
  /**
   * POST /api/v1/projects/:projectId/endpoints
   */
  async createEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = projectIdParamSchema.parse(req.params);
      const parsedBody = createEndpointSchema.parse(req.body);

      const userId = req.user!.id;
      const endpoint = await endpointService.createEndpoint(userId, projectId, parsedBody);

      res.status(201).json({
        status: 'success',
        message: 'Endpoint created successfully',
        endpoint,
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
   * GET /api/v1/projects/:projectId/endpoints
   */
  async listEndpoints(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = projectIdParamSchema.parse(req.params);
      const userId = req.user!.id;

      const endpoints = await endpointService.listEndpoints(userId, projectId);

      res.status(200).json({
        status: 'success',
        endpoints,
        count: endpoints.length,
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
   * GET /api/v1/endpoints/:id
   */
  async getEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = endpointIdParamSchema.parse(req.params);
      const userId = req.user!.id;

      const endpoint = await endpointService.getEndpoint(userId, id);

      res.status(200).json({
        status: 'success',
        endpoint,
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
   * PATCH /api/v1/endpoints/:id
   */
  async updateEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = endpointIdParamSchema.parse(req.params);
      const parsedBody = updateEndpointSchema.parse(req.body);

      const userId = req.user!.id;
      const endpoint = await endpointService.updateEndpoint(userId, id, parsedBody);

      res.status(200).json({
        status: 'success',
        message: 'Endpoint updated successfully',
        endpoint,
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
   * DELETE /api/v1/endpoints/:id
   */
  async deleteEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = endpointIdParamSchema.parse(req.params);
      const userId = req.user!.id;

      await endpointService.deleteEndpoint(userId, id);

      res.status(200).json({
        status: 'success',
        message: 'Endpoint deleted successfully',
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

export const endpointController = new EndpointController();

