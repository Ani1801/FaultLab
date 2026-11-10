import type { Request, Response, NextFunction } from 'express';
import { workspaceService } from './workspace.service.js';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  workspaceIdParamSchema,
} from './workspace.schemas.js';

export class WorkspaceController {
  async createWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = createWorkspaceSchema.safeParse(req.body);

      if (!parsedBody.success) {
        res.status(400).json({
          status: 'error',
          message: parsedBody.error.errors[0]?.message || 'Invalid workspace data',
          details: parsedBody.error.format(),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Owner ID is derived exclusively from authenticated session
      const userId = req.user!.id;
      const workspace = await workspaceService.createWorkspace(userId, parsedBody.data);

      res.status(201).json({
        status: 'success',
        message: 'Workspace created successfully',
        workspace,
      });
    } catch (error) {
      next(error);
    }
  }

  async listWorkspaces(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const workspaces = await workspaceService.listWorkspaces(userId);

      res.status(200).json({
        status: 'success',
        workspaces,
        count: workspaces.length,
      });
    } catch (error) {
      next(error);
    }
  }

  async getWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedParams = workspaceIdParamSchema.safeParse(req.params);

      if (!parsedParams.success) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid workspace ID format',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const userId = req.user!.id;
      const workspace = await workspaceService.getWorkspace(userId, parsedParams.data.id);

      res.status(200).json({
        status: 'success',
        workspace,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedParams = workspaceIdParamSchema.safeParse(req.params);

      if (!parsedParams.success) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid workspace ID format',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsedBody = updateWorkspaceSchema.safeParse(req.body);

      if (!parsedBody.success) {
        res.status(400).json({
          status: 'error',
          message: parsedBody.error.errors[0]?.message || 'Invalid update data',
          details: parsedBody.error.format(),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const userId = req.user!.id;
      const updated = await workspaceService.updateWorkspace(
        userId,
        parsedParams.data.id,
        parsedBody.data
      );

      res.status(200).json({
        status: 'success',
        message: 'Workspace updated successfully',
        workspace: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteWorkspace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedParams = workspaceIdParamSchema.safeParse(req.params);

      if (!parsedParams.success) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid workspace ID format',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const userId = req.user!.id;
      await workspaceService.deleteWorkspace(userId, parsedParams.data.id);

      res.status(200).json({
        status: 'success',
        message: 'Workspace deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const workspaceController = new WorkspaceController();

