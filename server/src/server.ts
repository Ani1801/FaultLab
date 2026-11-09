import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { prisma } from './utils/prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`FaultLab Server running in [${env.NODE_ENV}] mode on port ${env.PORT}`);
  logger.info(`Health check available at: http://localhost:${env.PORT}/api/v1/health`);
});

// Graceful shutdown handler
const handleShutdown = async (signal: string) => {
  logger.info(`${signal} signal received. Closing FaultLab HTTP server...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await prisma.$disconnect();
      logger.info('Prisma database connection closed.');
    } catch (err) {
      logger.error('Error disconnecting Prisma on shutdown:', err);
    }
    process.exit(0);
  });

  // Force shutdown after timeout if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Forceful shutdown triggered after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

