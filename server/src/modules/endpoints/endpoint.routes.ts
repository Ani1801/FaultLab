import { Router } from 'express';
import { endpointController } from './endpoint.controller.js';
import { requireAuth } from '../../middleware/auth.js';

// Router for /api/v1/projects/:projectId/endpoints
export const projectEndpointsRouter = Router({ mergeParams: true });
projectEndpointsRouter.use(requireAuth);

projectEndpointsRouter.post('/', (req, res, next) =>
  endpointController.createEndpoint(req, res, next)
);
projectEndpointsRouter.get('/', (req, res, next) =>
  endpointController.listEndpoints(req, res, next)
);

// Router for /api/v1/endpoints/:id
export const endpointRouter = Router();
endpointRouter.use(requireAuth);

endpointRouter.get('/:id', (req, res, next) =>
  endpointController.getEndpoint(req, res, next)
);
endpointRouter.patch('/:id', (req, res, next) =>
  endpointController.updateEndpoint(req, res, next)
);
endpointRouter.delete('/:id', (req, res, next) =>
  endpointController.deleteEndpoint(req, res, next)
);

