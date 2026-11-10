import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { projectService } from './project.service.js';
import {
  createProjectSchema,
  updateProjectSchema,
  workspaceIdParamSchema,
  projectIdParamSchema,
} from './project.schemas.js';

export class ProjectController {
  /**
   * POST /api/v1/workspaces/:workspaceId/projects
   */
  async createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = workspaceIdParamSchema.parse(req.params);
      const parsedBody = createProjectSchema.parse(req.body);

      const userId = req.user!.id;
      const project = await projectService.createProject(userId, workspaceId, parsedBody);

      res.status(201).json({
        status: 'success',
        message: 'Project created successfully',
        project,
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
   * GET /api/v1/workspaces/:workspaceId/projects
   */
  async listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = workspaceIdParamSchema.parse(req.params);
      const userId = req.user!.id;

      const projects = await projectService.listProjects(userId, workspaceId);

      res.status(200).json({
        status: 'success',
        projects,
        count: projects.length,
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
   * GET /api/v1/projects/:id
   */
  async getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = projectIdParamSchema.parse(req.params);
      const userId = req.user!.id;

      const project = await projectService.getProject(userId, id);

      res.status(200).json({
        status: 'success',
        project,
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
   * PATCH /api/v1/projects/:id
   */
  async updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = projectIdParamSchema.parse(req.params);
      const parsedBody = updateProjectSchema.parse(req.body);
      const userId = req.user!.id;

      const project = await projectService.updateProject(userId, id, parsedBody);

      res.status(200).json({
        status: 'success',
        message: 'Project updated successfully',
        project,
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
   * DELETE /api/v1/projects/:id
   */
  async deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = projectIdParamSchema.parse(req.params);
      const userId = req.user!.id;

      await projectService.deleteProject(userId, id);

      res.status(200).json({
        status: 'success',
        message: 'Project deleted successfully',
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

export const projectController = new ProjectController();

