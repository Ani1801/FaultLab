import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import type { HealthCheckResponse, DatabaseHealthInfo } from './health.types.js';

export class HealthService {
  /**
   * Check PostgreSQL connectivity via Prisma by executing a raw test query.
   * Accurately reports connected status with latency, or disconnected status with the error reason.
   */
  async checkDatabase(): Promise<DatabaseHealthInfo> {
    const startTime = performance.now();
    try {
      // Execute a lightweight query to verify active connectivity with the PostgreSQL database
      await prisma.$queryRaw`SELECT 1`;
      const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
      return {
        status: 'connected',
        latencyMs,
        error: null,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      logger.error('PostgreSQL database health check failed:', errorMessage);
      return {
        status: 'disconnected',
        latencyMs: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Aggregate overall system health status.
   */
  async getHealthStatus(): Promise<HealthCheckResponse> {
    const dbHealth = await this.checkDatabase();
    const isDbConnected = dbHealth.status === 'connected';

    return {
      status: isDbConnected ? 'healthy' : 'degraded',
      server: {
        status: 'up',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
      },
      database: dbHealth,
    };
  }
}

export const healthService = new HealthService();

