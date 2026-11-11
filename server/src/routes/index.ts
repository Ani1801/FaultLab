import { Router } from 'express';
import { healthRouter } from '../modules/health/health.routes.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { workspaceRouter } from '../modules/workspaces/workspace.routes.js';
import {
  workspaceProjectsRouter,
  projectRouter,
} from '../modules/projects/project.routes.js';
import {
  projectEndpointsRouter,
  endpointRouter,
} from '../modules/endpoints/endpoint.routes.js';
import {
  projectRequestsRouter,
  projectAnalyticsRouter,
} from '../modules/requests/requestLog.routes.js';
import {
  projectApiTestsRouter,
  apiTestRouter,
  apiTestRunRouter,
} from '../modules/api-testing/apiTest.routes.js';
import {
  diagnosticRunRouter,
  projectDiagnosticsRouter,
} from '../modules/diagnostics/diagnostic.routes.js';

export const apiRouter = Router();

// Mount module routes under /api/v1
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/workspaces', workspaceRouter);
apiRouter.use('/workspaces/:workspaceId/projects', workspaceProjectsRouter);
apiRouter.use('/projects/:projectId/endpoints', projectEndpointsRouter);
apiRouter.use('/projects/:projectId/requests', projectRequestsRouter);
apiRouter.use('/projects/:projectId/analytics', projectAnalyticsRouter);
apiRouter.use('/projects/:projectId/api-tests', projectApiTestsRouter);
apiRouter.use('/projects/:projectId/diagnostics', projectDiagnosticsRouter);
apiRouter.use('/projects', projectRouter);
apiRouter.use('/endpoints', endpointRouter);
apiRouter.use('/api-tests', apiTestRouter);
apiRouter.use('/api-test-runs', apiTestRunRouter);
apiRouter.use('/api-test-runs/:runId/diagnostics', diagnosticRunRouter);





