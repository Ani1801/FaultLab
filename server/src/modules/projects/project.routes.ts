import { Router } from 'express';
import { projectController } from './project.controller.js';
import { requireAuth } from '../../middleware/auth.js';

// Router for /api/v1/workspaces/:workspaceId/projects
export const workspaceProjectsRouter = Router({ mergeParams: true });
workspaceProjectsRouter.use(requireAuth);

workspaceProjectsRouter.post('/', (req, res, next) =>
  projectController.createProject(req, res, next)
);
workspaceProjectsRouter.get('/', (req, res, next) =>
  projectController.listProjects(req, res, next)
);

// Router for /api/v1/projects/:id
export const projectRouter = Router();
projectRouter.use(requireAuth);

projectRouter.get('/:id', (req, res, next) =>
  projectController.getProject(req, res, next)
);
projectRouter.patch('/:id', (req, res, next) =>
  projectController.updateProject(req, res, next)
);
projectRouter.delete('/:id', (req, res, next) =>
  projectController.deleteProject(req, res, next)
);

