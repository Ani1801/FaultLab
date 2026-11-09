import type { Request, Response, NextFunction } from 'express';
import { healthService } from './health.service.js';

export const getHealth = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const health = await healthService.getHealthStatus();
    // Return 200 when healthy, 503 Service Unavailable when core dependency (database) is disconnected
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    next(error);
  }
};

