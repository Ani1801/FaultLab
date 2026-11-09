import { Router } from 'express';
import { healthRouter } from '../modules/health/health.routes.js';

export const apiRouter = Router();

// Mount module routes under /api/v1
apiRouter.use('/health', healthRouter);

