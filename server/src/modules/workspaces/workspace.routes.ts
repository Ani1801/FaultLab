import { Router } from 'express';
import { workspaceController } from './workspace.controller.js';
import { requireAuth } from '../../middleware/auth.js';

export const workspaceRouter = Router();

// Protect all workspace routes with authentication middleware
workspaceRouter.use(requireAuth);

workspaceRouter.post('/', (req, res, next) => workspaceController.createWorkspace(req, res, next));
workspaceRouter.get('/', (req, res, next) => workspaceController.listWorkspaces(req, res, next));
workspaceRouter.get('/:id', (req, res, next) => workspaceController.getWorkspace(req, res, next));
workspaceRouter.patch('/:id', (req, res, next) => workspaceController.updateWorkspace(req, res, next));
workspaceRouter.delete('/:id', (req, res, next) => workspaceController.deleteWorkspace(req, res, next));

