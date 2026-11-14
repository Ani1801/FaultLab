import type { Request, Response, NextFunction } from 'express';

export interface ConcurrencyLimiterOptions {
  maxConcurrent: number;
  message?: string;
  statusCode?: 429 | 503;
  keyGenerator?: (req: Request) => string;
}

export interface ConcurrencyLimiterInstance {
  (req: Request, res: Response, next: NextFunction): void;
  getActiveCount(key: string): number;
  clearAll(): void;
}

/**
 * Creates an in-memory bounded concurrency limiter per key (e.g. authenticated user id).
 * Releases execution slots reliably on success, error, timeout, or socket cancellation.
 * Zero external dependencies; zero paid services.
 */
export function createConcurrencyLimiter(options: ConcurrencyLimiterOptions): ConcurrencyLimiterInstance {
  const {
    maxConcurrent,
    message = 'Too many concurrent operations in progress. Please wait for current operations to finish.',
    statusCode = 429,
    keyGenerator = (req: Request): string => {
      const user = (req as any).user;
      if (user && user.id) {
        return `user:${user.id}`;
      }
      return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    },
  } = options;

  const activeMap = new Map<string, number>();

  const middleware = ((req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const current = activeMap.get(key) || 0;

    if (current >= maxConcurrent) {
      res.setHeader('Retry-After', '1');
      res.status(statusCode).json({
        status: 'error',
        message,
        retryAfter: 1,
      });
      return;
    }

    // Acquire slot
    activeMap.set(key, current + 1);

    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;

      const remaining = (activeMap.get(key) || 1) - 1;
      if (remaining <= 0) {
        activeMap.delete(key);
      } else {
        activeMap.set(key, remaining);
      }
    };

    // Ensure slot is released on response completion, error, or socket close/abort
    res.once('finish', release);
    res.once('close', release);

    next();
  }) as ConcurrencyLimiterInstance;

  middleware.getActiveCount = (key: string): number => {
    return activeMap.get(key) || 0;
  };

  middleware.clearAll = (): void => {
    activeMap.clear();
  };

  return middleware;
}

/**
 * Concurrency limiter for outbound API test executions:
 * Allows a maximum of 2 simultaneous test runs per authenticated user.
 */
export const apiTestConcurrencyLimiter = createConcurrencyLimiter({
  maxConcurrent: 2,
  message: 'Concurrent API test execution limit reached (max 2 simultaneous tests). Please wait for the running test to complete.',
  statusCode: 429,
});

/**
 * Concurrency limiter for diagnostic computations:
 * Allows a maximum of 2 simultaneous diagnostic runs/summaries per authenticated user.
 */
export const diagnosticConcurrencyLimiter = createConcurrencyLimiter({
  maxConcurrent: 2,
  message: 'Concurrent diagnostic computation limit reached. Please wait for active diagnostics to complete.',
  statusCode: 429,
});

