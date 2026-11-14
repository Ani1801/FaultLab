import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

export interface RateLimiterOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests allowed within windowMs
  message?: string; // Custom error message
  keyGenerator?: (req: Request) => string; // Custom key extraction
  skip?: (req: Request) => boolean; // Skip rate limiting conditionally
}

/**
 * High-performance, lightweight in-memory sliding window rate limiter.
 * Zero external dependencies; safely prunes expired records to prevent memory growth.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests. Please try again later.',
    keyGenerator = (req: Request) => {
      // Prefer authenticated user id if present, otherwise fall back to client IP
      const user = (req as any).user;
      if (user && user.id) {
        return `user:${user.id}`;
      }
      return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    },
    skip,
  } = options;

  const storage = new Map<string, RateLimitRecord>();

  // Periodically clean up stale client entries (every 60s)
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of storage.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
      if (record.timestamps.length === 0) {
        storage.delete(key);
      }
    }
  }, 60000);

  // Unref interval timer so it does not block Node process termination
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (skip && skip(req)) {
      next();
      return;
    }

    const key = keyGenerator(req);
    const now = Date.now();

    let record = storage.get(key);
    if (!record) {
      record = { timestamps: [] };
      storage.set(key, record);
    }

    // Filter out timestamps outside the active sliding window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    const currentCount = record.timestamps.length;
    const remaining = Math.max(0, maxRequests - currentCount - 1);
    const oldestTimestamp = record.timestamps[0] || now;
    const resetTimeMs = oldestTimestamp + windowMs;
    const retryAfterSec = Math.ceil((resetTimeMs - now) / 1000);

    // Set standard RateLimit response headers
    res.setHeader('RateLimit-Limit', maxRequests.toString());
    res.setHeader('RateLimit-Remaining', remaining.toString());
    res.setHeader('RateLimit-Reset', Math.ceil(resetTimeMs / 1000).toString());

    if (currentCount >= maxRequests) {
      res.setHeader('Retry-After', retryAfterSec.toString());
      res.status(429).json({
        status: 'error',
        message,
        retryAfter: retryAfterSec,
      });
      return;
    }

    record.timestamps.push(now);
    next();
  };
}

// 1. Authentication Rate Limiter: 15 attempts per 15 minutes per IP + account identifier
// Prevents brute-force attacks while isolating individual accounts on shared proxies
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 15,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (email) {
      const emailHash = crypto.createHash('sha256').update(email).digest('hex').slice(0, 16);
      return `auth:${ip}:${emailHash}`;
    }
    return `auth:${ip}`;
  },
});

// 2. Agent Pairing Code Generation Rate Limiter: 10 code requests per 15 minutes per user/IP
export const pairingGenRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many pairing code generation requests. Please wait before generating another code.',
});

// 3. Agent Pairing Code Exchange Rate Limiter: 15 attempts per 15 minutes per IP
export const pairingExchangeRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 15,
  message: 'Too many pairing verification attempts. Please try again later.',
  keyGenerator: (req) => `pair_exchange:${req.ip || req.socket.remoteAddress || 'unknown'}`,
});

// 4. Outbound API Test Execution Rate Limiter: 30 executions per minute per user/IP
export const apiTestExecutionRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'API test execution rate limit exceeded (max 30 runs per minute). Please wait a moment.',
});

// 5. Diagnostic Engine Rate Limiter: 30 runs per minute per user/IP
export const diagnosticRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Diagnostic generation rate limit exceeded. Please wait a moment before running diagnostics.',
});

// 6. Local Agent Runtime Allowance: 200 requests per minute per agent token / IP
// Allows frequent polling and heartbeats without false-positive rate limiting
// Hashes the agent token with SHA-256 so raw tokens or slices are never stored or logged in memory
export const agentRuntimeRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 200,
  message: 'Agent polling frequency exceeded. Adjust polling backoff interval.',
  keyGenerator: (req) => {
    const token = req.headers['x-faultlab-agent-token'];
    if (token && typeof token === 'string') {
      const hashed = crypto.createHash('sha256').update(token).digest('hex');
      return `agent:${hashed}`;
    }
    return `agent_ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
  },
});

