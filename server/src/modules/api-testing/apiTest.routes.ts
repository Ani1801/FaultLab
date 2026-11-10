import { Router } from 'express';
import { apiTestController } from './apiTest.controller.js';
import { requireAuth } from '../../middleware/auth.js';

// Router for /api/v1/projects/:projectId/api-tests
export const projectApiTestsRouter = Router({ mergeParams: true });
projectApiTestsRouter.use(requireAuth);

projectApiTestsRouter.post('/', (req, res, next) =>
  apiTestController.createApiTest(req, res, next)
);
projectApiTestsRouter.get('/', (req, res, next) =>
  apiTestController.listApiTests(req, res, next)
);
projectApiTestsRouter.post('/execute', (req, res, next) =>
  apiTestController.executeUnsavedTest(req, res, next)
);

// Router for /api/v1/api-tests/:id
export const apiTestRouter = Router();
apiTestRouter.use(requireAuth);

apiTestRouter.get('/:id', (req, res, next) =>
  apiTestController.getApiTest(req, res, next)
);
apiTestRouter.patch('/:id', (req, res, next) =>
  apiTestController.updateApiTest(req, res, next)
);
apiTestRouter.delete('/:id', (req, res, next) =>
  apiTestController.deleteApiTest(req, res, next)
);
apiTestRouter.post('/:id/run', (req, res, next) =>
  apiTestController.runApiTest(req, res, next)
);
apiTestRouter.get('/:id/runs', (req, res, next) =>
  apiTestController.listTestRuns(req, res, next)
);

// Router for /api/v1/api-test-runs/:runId
export const apiTestRunRouter = Router();
apiTestRunRouter.use(requireAuth);

apiTestRunRouter.get('/:runId', (req, res, next) =>
  apiTestController.getTestRun(req, res, next)
);

