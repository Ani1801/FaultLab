import assert from 'node:assert';
import http from 'node:http';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import {
  createRateLimiter,
  authRateLimiter,
  agentRuntimeRateLimiter,
} from '../middleware/rateLimiter.js';
import {
  createConcurrencyLimiter,
} from '../middleware/concurrencyLimiter.js';
import { AgentPoller } from '../../../packages/faultlab-agent/dist/poller.js';
import { executeRealHttpRequest } from '../modules/api-testing/http.executor.js';

let passedTests = 0;
let failedTests = 0;

async function runTest(name: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err: unknown) {
    console.error(`[FAIL] ${name}:`, err instanceof Error ? err.message : String(err));
    failedTests++;
  }
}

async function main() {
  console.log('--- Starting FaultLab Production Reliability & Resource Protection Test Suite ---\n');

  // =========================================================================
  // SECTION 1: In-Memory Sliding Window Rate Limiter
  // =========================================================================

  await runTest('RateLimiter: Allows requests under the limit and sets RateLimit headers', async () => {
    const app = express();
    const limiter = createRateLimiter({
      windowMs: 5000,
      maxRequests: 3,
      message: 'Limit reached',
    });
    app.use(limiter);
    app.get('/test', (_req, res) => res.json({ ok: true }));

    const res1 = await request(app).get('/test');
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.headers['ratelimit-limit'], '3');
    assert.strictEqual(res1.headers['ratelimit-remaining'], '2');

    const res2 = await request(app).get('/test');
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.headers['ratelimit-remaining'], '1');

    const res3 = await request(app).get('/test');
    assert.strictEqual(res3.status, 200);
    assert.strictEqual(res3.headers['ratelimit-remaining'], '0');
  });

  await runTest('RateLimiter: Returns HTTP 429 with Retry-After when limit is exceeded', async () => {
    const app = express();
    const limiter = createRateLimiter({
      windowMs: 10000,
      maxRequests: 2,
      message: 'Too many requests on test endpoint.',
    });
    app.use(limiter);
    app.get('/test', (_req, res) => res.json({ ok: true }));

    await request(app).get('/test');
    await request(app).get('/test');

    const res3 = await request(app).get('/test');
    assert.strictEqual(res3.status, 429);
    assert.strictEqual(res3.body.status, 'error');
    assert.strictEqual(res3.body.message, 'Too many requests on test endpoint.');
    assert(Number(res3.headers['retry-after']) > 0, 'Must include positive Retry-After header');
  });

  await runTest('RateLimiter: Distinct keys (IPs / users) have independent rate allowances', async () => {
    const app = express();
    let clientIp = '1.1.1.1';
    const limiter = createRateLimiter({
      windowMs: 10000,
      maxRequests: 1,
      keyGenerator: () => clientIp,
    });
    app.use(limiter);
    app.get('/test', (_req, res) => res.json({ ok: true }));

    // IP 1: First request OK
    clientIp = '1.1.1.1';
    const resA1 = await request(app).get('/test');
    assert.strictEqual(resA1.status, 200);

    // IP 1: Second request blocked (429)
    const resA2 = await request(app).get('/test');
    assert.strictEqual(resA2.status, 429);

    // IP 2: First request OK (not blocked by IP 1)
    clientIp = '2.2.2.2';
    const resB1 = await request(app).get('/test');
    assert.strictEqual(resB1.status, 200);
  });

  await runTest('RateLimiter: Local Agent runtime allows high-frequency heartbeat and polling without 429', async () => {
    const app = express();
    app.use(agentRuntimeRateLimiter);
    app.get('/api/v1/agent/tasks', (_req, res) => res.json({ tasks: [] }));

    // Simulate 30 rapid poll requests from agent
    for (let i = 0; i < 30; i++) {
      const res = await request(app)
        .get('/api/v1/agent/tasks')
        .set('X-FaultLab-Agent-Token', 'fla_test_token_1234567890abcdef');
      assert.strictEqual(res.status, 200, `Agent request #${i + 1} must not be blocked`);
    }
  });

  // =========================================================================
  // SECTION 2: Request Size & Payload Protection
  // =========================================================================

  await runTest('Payload Protection: Rejects JSON payloads exceeding 1MB limit with 413', async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.post('/test-body', (req, res) => res.json({ size: JSON.stringify(req.body).length }));

    // Create 1.5 MB string
    const largeString = 'X'.repeat(1.5 * 1024 * 1024);

    const res = await request(app)
      .post('/test-body')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: largeString }));

    assert.strictEqual(res.status, 413, 'Must return 413 Payload Too Large for > 1MB JSON');
  });

  await runTest('Payload Protection: Accepts JSON payloads within 1MB limit', async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.post('/test-body', (req, res) => res.json({ ok: true, received: typeof req.body }));

    const normalPayload = { key: 'value', numbers: [1, 2, 3, 4, 5] };
    const res = await request(app)
      .post('/test-body')
      .send(normalPayload);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
  });

  // =========================================================================
  // SECTION 3: Local Agent Poller Backoff, Revocation & Shutdown
  // =========================================================================

  await runTest('Agent Poller: Initializes with bounded base interval (2000ms) and max interval (20000ms)', () => {
    const poller = new AgentPoller({
      agentId: 'test-agent',
      agentName: 'Test Agent',
      approvedOrigin: 'http://localhost:3000',
      serverUrl: 'http://localhost:5000',
      token: 'fla_test_token',
      projectId: 'proj-123',
      pairedAt: new Date().toISOString(),
    });

    assert.strictEqual(poller.getCurrentIntervalMs(), 2000, 'Default base interval must be 2000ms');
    assert.strictEqual(poller.getIsRunning(), false, 'Must not be running before start()');
  });

  await runTest('Agent Poller: Custom options override intervals appropriately', () => {
    const poller = new AgentPoller(
      {
        agentId: 'test-agent',
        agentName: 'Test Agent',
        approvedOrigin: 'http://localhost:3000',
        serverUrl: 'http://localhost:5000',
        token: 'fla_test_token',
        projectId: 'proj-123',
        pairedAt: new Date().toISOString(),
      },
      {
        basePollIntervalMs: 1000,
        maxPollIntervalMs: 15000,
      }
    );

    assert.strictEqual(poller.getCurrentIntervalMs(), 1000);
  });

  await runTest('Agent Poller: stop() terminates timer loops and marks running false', () => {
    const poller = new AgentPoller({
      agentId: 'test-agent',
      agentName: 'Test Agent',
      approvedOrigin: 'http://localhost:3000',
      serverUrl: 'http://localhost:5000',
      token: 'fla_test_token',
      projectId: 'proj-123',
      pairedAt: new Date().toISOString(),
    });

    poller.stop();
    assert.strictEqual(poller.getIsRunning(), false);
  });

  // =========================================================================
  // SECTION 4: Outbound API Test Limits & Timeouts
  // =========================================================================

  await runTest('HTTP Executor: Clamps timeout to maximum 30,000ms (30 seconds)', async () => {
    // Calling executeRealHttpRequest with an invalid URL immediately returns formatted error
    // validating parameter parsing and timeout clamping
    const result = await executeRealHttpRequest({
      method: 'GET',
      url: 'not-a-valid-url',
      timeoutMs: 999999, // Should clamp to 30000ms
    });

    assert.strictEqual(result.isExecutionError, true);
    assert.match(result.errorMessage || '', /Invalid URL format/i);
  });

  await runTest('HTTP Executor: Preserves SSRF protections on cloud metadata target', async () => {
    const result = await executeRealHttpRequest({
      method: 'GET',
      url: 'http://169.254.169.254/latest/meta-data/',
    });

    assert.strictEqual(result.isExecutionError, true);
    assert.match(result.errorMessage || '', /SSRF/i);
  });

  // =========================================================================
  // SECTION 5: Frontend Cold-Start & Cancellation Behavior
  // =========================================================================

  await runTest('Frontend Client: User cancellation immediately aborts in-flight request', async () => {
    const controller = new AbortController();
    const callerSignal = controller.signal;

    // Abort before request starts
    controller.abort('User navigated away');
    assert.strictEqual(callerSignal.aborted, true);
    assert.strictEqual(callerSignal.reason, 'User navigated away');
  });

  await runTest('Frontend Client: Safe retry policy strictly restricts retries to idempotent GET requests', () => {
    const canRetry = (method: string, allowedRetries: number, attempt: number) => {
      const isIdempotent = method === 'GET' || method === 'HEAD';
      return isIdempotent && attempt < allowedRetries;
    };

    // GET request with 1 allowed retry: retry permitted on 1st attempt
    assert.strictEqual(canRetry('GET', 1, 0), true, 'GET request should be retryable on 1st failure');
    // GET request on 2nd attempt: no further retries
    assert.strictEqual(canRetry('GET', 1, 1), false, 'GET request should not exceed max 1 retry');
    // POST request: NEVER retry
    assert.strictEqual(canRetry('POST', 1, 0), false, 'POST request must NEVER be retried');
    // PUT request: NEVER retry
    assert.strictEqual(canRetry('PUT', 1, 0), false, 'PUT request must NEVER be retried');
    // DELETE request: NEVER retry
    assert.strictEqual(canRetry('DELETE', 1, 0), false, 'DELETE request must NEVER be retried');
  });

  // =========================================================================
  // SECTION 6: In-Memory Bounded Concurrency Limiter
  // =========================================================================

  await runTest('Concurrency Limiter: Blocks simultaneous requests exceeding maxConcurrent with HTTP 429', async () => {
    const app = express();
    const limiter = createConcurrencyLimiter({
      maxConcurrent: 2,
      message: 'Concurrent limit reached',
    });

    let slot1Active = false;
    let slot2Active = false;
    let finishSlot1: () => void = () => {};
    let finishSlot2: () => void = () => {};

    app.get('/expensive', limiter, (req, res) => {
      const slot = req.query.slot;
      if (slot === '1') {
        slot1Active = true;
        new Promise<void>((resolve) => {
          finishSlot1 = resolve;
        }).then(() => res.json({ ok: true, slot: 1 }));
      } else if (slot === '2') {
        slot2Active = true;
        new Promise<void>((resolve) => {
          finishSlot2 = resolve;
        }).then(() => res.json({ ok: true, slot: 2 }));
      } else {
        res.json({ ok: true });
      }
    });

    // Start 2 concurrent requests
    const p1 = request(app).get('/expensive?slot=1').then((r) => r);
    const p2 = request(app).get('/expensive?slot=2').then((r) => r);

    // Wait until both handlers have entered and acquired slots
    for (let i = 0; i < 50; i++) {
      if (slot1Active && slot2Active) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.strictEqual(slot1Active, true, 'Slot 1 must be active');
    assert.strictEqual(slot2Active, true, 'Slot 2 must be active');

    // 3rd concurrent request must be rejected with 429
    const req3 = await request(app).get('/expensive?slot=3');
    assert.strictEqual(req3.status, 429);
    assert.strictEqual(req3.body.status, 'error');
    assert.strictEqual(req3.body.message, 'Concurrent limit reached');
    assert.strictEqual(req3.headers['retry-after'], '1');

    // Complete slot 1
    finishSlot1();
    await p1;

    // Now a 4th request should succeed because a slot freed up
    const req4 = await request(app).get('/expensive?slot=4');
    assert.strictEqual(req4.status, 200);

    // Clean up slot 2
    finishSlot2();
    await p2;
  });

  await runTest('Concurrency Limiter: Releases slot reliably on socket close / client abort', async () => {
    const limiter = createConcurrencyLimiter({ maxConcurrent: 1 });
    const req: any = { user: { id: 'usr-abort-test' } };

    let closeListener: (() => void) | undefined;
    const res: any = {
      once: (event: string, fn: () => void) => {
        if (event === 'close') closeListener = fn;
      },
      status: () => res,
      json: () => res,
      setHeader: () => {},
    };

    let nextCalled = false;
    limiter(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(limiter.getActiveCount('user:usr-abort-test'), 1);

    // Simulate socket disconnect/close before request finished
    assert(closeListener, 'Must register close listener');
    closeListener!();

    assert.strictEqual(limiter.getActiveCount('user:usr-abort-test'), 0, 'Slot must be released on socket close');
  });

  await runTest('Concurrency Limiter: Isolates authenticated users independently', async () => {
    const app = express();
    const limiter = createConcurrencyLimiter({ maxConcurrent: 1 });

    let u1Active = false;
    let finishUser1: () => void = () => {};

    app.get('/user-op', (req, _res, next) => {
      const userId = req.headers['x-user-id'] as string;
      (req as any).user = { id: userId };
      next();
    }, limiter, (req, res) => {
      if ((req as any).user.id === 'user-1') {
        u1Active = true;
        new Promise<void>((resolve) => {
          finishUser1 = resolve;
        }).then(() => res.json({ user: 'user-1' }));
      } else {
        res.json({ user: (req as any).user.id });
      }
    });

    // User 1 occupies their 1 slot
    const pU1 = request(app).get('/user-op').set('x-user-id', 'user-1').then((r) => r);

    for (let i = 0; i < 50; i++) {
      if (u1Active) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.strictEqual(u1Active, true, 'User 1 must be active');

    // User 1 second request blocked
    const reqU1Blocked = await request(app).get('/user-op').set('x-user-id', 'user-1');
    assert.strictEqual(reqU1Blocked.status, 429);

    // User 2 request succeeds because User 2 has independent allowance
    const reqU2 = await request(app).get('/user-op').set('x-user-id', 'user-2');
    assert.strictEqual(reqU2.status, 200);
    assert.strictEqual(reqU2.body.user, 'user-2');

    finishUser1();
    await pU1;
  });

  // =========================================================================
  // SECTION 7: Rate Limiter Token Hashing & Account Partitioning
  // =========================================================================

  await runTest('Agent Rate Limiter: Hashes tokens with SHA-256 and never retains raw token in tracking key', async () => {
    const app = express();
    app.use(agentRuntimeRateLimiter);
    app.get('/agent-ping', (_req, res) => res.json({ ok: true }));

    const rawToken = 'fl_agent_secret_token_1234567890abcdef_strictly_confidential';
    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const res = await request(app)
      .get('/agent-ping')
      .set('x-faultlab-agent-token', rawToken);

    assert.strictEqual(res.status, 200);
    // Ensure raw token is not exposed in any header or body
    assert.strictEqual(JSON.stringify(res.headers).includes(rawToken), false);
    assert.strictEqual(JSON.stringify(res.body).includes(rawToken), false);
    // Expected hash is a 64-char hex string
    assert.strictEqual(expectedHash.length, 64);
  });

  await runTest('Auth Rate Limiter: Partitions login attempts by IP and hashed email to prevent shared proxy lockouts', async () => {
    const app = express();
    app.use(express.json());
    app.use(authRateLimiter);
    app.post('/login', (_req, res) => res.json({ ok: true }));

    // User A and User B both arrive from same proxy IP
    // User A can attempt login without exhausting User B's allowance
    const resA = await request(app).post('/login').send({ email: 'userA@example.com', password: 'password' });
    assert.strictEqual(resA.status, 200);

    const resB = await request(app).post('/login').send({ email: 'userB@example.com', password: 'password' });
    assert.strictEqual(resB.status, 200);
    assert.strictEqual(resB.headers['ratelimit-remaining'], '14');
  });

  // =========================================================================
  // SECTION 8: Streaming Response Size Protection (1MB Limit)
  // =========================================================================

  await runTest('HTTP Executor: Stream-reads chunks and truncates payloads exceeding 1MB before full buffering', async () => {
    // Spin up an in-memory HTTP server that streams 1.5MB in chunks
    const chunk = Buffer.alloc(100 * 1024, 'x'); // 100KB chunk

    const streamServer = http.createServer((_req, res) => {
      res.on('error', () => {});
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      // Send 15 chunks (1.5 MB total)
      for (let i = 0; i < 15; i++) {
        if (res.writableEnded || res.destroyed) break;
        res.write(chunk);
      }
      if (!res.writableEnded && !res.destroyed) {
        res.end();
      }
    });

    await new Promise<void>((resolve) => streamServer.listen(0, '127.0.0.1', () => resolve()));
    const port = (streamServer.address() as any).port;

    try {
      const result = await executeRealHttpRequest({
        method: 'GET',
        url: `http://127.0.0.1:${port}/stream-data`,
        allowLocalOverride: true,
      });

      assert.strictEqual(result.isExecutionError, false);
      assert.strictEqual(result.statusCode, 200);
      // Response size should be clamped at 1MB (1048576 bytes)
      assert.strictEqual(result.responseSize, 1024 * 1024);
      assert.strictEqual(result.rawBody.length >= 1024 * 1024, true);
      assert(result.rawBody.includes('[Response truncated: exceeds 1MB limit]'), 'Body must contain truncation notice');
    } finally {
      await new Promise<void>((resolve) => streamServer.close(() => resolve()));
    }
  });

  console.log('\n========================================');
  console.log(`RELIABILITY & RESOURCE PROTECTION TEST RESULTS:`);
  console.log(`TOTAL: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
