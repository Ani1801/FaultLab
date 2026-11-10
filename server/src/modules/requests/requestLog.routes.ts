import { Router } from 'express';
import { requestLogController } from './requestLog.controller.js';
import { requireAuth } from '../../middleware/auth.js';

// Router for /api/v1/projects/:projectId/requests
export const projectRequestsRouter = Router({ mergeParams: true });
projectRequestsRouter.use(requireAuth);

projectRequestsRouter.get('/', (req, res, next) =>
  requestLogController.listRequests(req, res, next)
);

projectRequestsRouter.get('/:requestId', (req, res, next) =>
  requestLogController.getRequest(req, res, next)
);

// Router for /api/v1/projects/:projectId/analytics
export const projectAnalyticsRouter = Router({ mergeParams: true });
projectAnalyticsRouter.use(requireAuth);

projectAnalyticsRouter.get('/', (req, res, next) =>
  requestLogController.getAnalytics(req, res, next)
);

