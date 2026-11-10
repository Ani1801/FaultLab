import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../utils/prisma.js';

const app = createApp();

interface TestReport {
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestReport[] = [];

const runTest = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    testResults.push({ name, passed: true });
    console.log(`[PASS] ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    testResults.push({ name, passed: false, error: message });
    console.error(`[FAIL] ${name}: ${message}`);
  }
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function executeFaultTestSuite() {
  console.log('--- Starting FaultLab Phase 5 Fault Injection Test Suite ---\n');

  // Track created entities for safe, isolated cleanup
  const createdUserIds: string[] = [];
  const createdWorkspaceIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdEndpointIds: string[] = [];

  const timestamp = Date.now();
  const userA = {
    name: 'Chaos Alice',
    email: `alice_fault_${timestamp}@example.com`,
    password: 'Password123!',
  };

  const userB = {
    name: 'Intruder Bob',
    email: `bob_fault_${timestamp}@example.com`,
    password: 'Password123!',
  };

  let userACookie: string[] = [];
  let userBCookie: string[] = [];
  let userAId = '';
  let userBId = '';

  let workspaceAId = '';
  let workspaceBId = '';
  let projectAId = '';

  let endpointNormalId = '';
  let endpointAlwaysId = '';
  let endpointRandomId = '';
  let endpointDisabledId = '';

  try {
    // -------------------------------------------------------------
    // Test Setup: Register isolated test users, workspace & project
    // -------------------------------------------------------------
    const regARes = await request(app).post('/api/v1/auth/register').send(userA);
    assert(regARes.status === 201 && Boolean(regARes.body?.user?.id), 'Setup Failure: User A registration');
    userACookie = regARes.headers['set-cookie'] as unknown as string[];
    userAId = regARes.body.user.id;
    createdUserIds.push(userAId);

    const regBRes = await request(app).post('/api/v1/auth/register').send(userB);
    assert(regBRes.status === 201 && Boolean(regBRes.body?.user?.id), 'Setup Failure: User B registration');
    userBCookie = regBRes.headers['set-cookie'] as unknown as string[];
    userBId = regBRes.body.user.id;
    createdUserIds.push(userBId);

    // Create Workspace A for User A
    const wsARes = await request(app)
      .post('/api/v1/workspaces')
      .set('Cookie', userACookie)
      .send({ name: 'Alice Chaos Workspace' });
    assert(wsARes.status === 201 && Boolean(wsARes.body?.workspace?.id), 'Setup Failure: Workspace A');
    workspaceAId = wsARes.body.workspace.id;
    createdWorkspaceIds.push(workspaceAId);

    // Create Workspace B for User B
    const wsBRes = await request(app)
      .post('/api/v1/workspaces')
      .set('Cookie', userBCookie)
      .send({ name: 'Bob Sandbox Workspace' });
    assert(wsBRes.status === 201 && Boolean(wsBRes.body?.workspace?.id), 'Setup Failure: Workspace B');
    workspaceBId = wsBRes.body.workspace.id;
    createdWorkspaceIds.push(workspaceBId);

    // Create Project A inside Workspace A
    const projARes = await request(app)
      .post(`/api/v1/workspaces/${workspaceAId}/projects`)
      .set('Cookie', userACookie)
      .send({ name: 'Payment Microservice', description: 'Simulated payment gateway with chaos testing' });
    assert(projARes.status === 201 && Boolean(projARes.body?.project?.id), 'Setup Failure: Project A');
    projectAId = projARes.body.project.id;
    createdProjectIds.push(projectAId);

    // =============================================================
    // 1. FAULT CONFIGURATION VALIDATION TESTS
    // =============================================================

    await runTest('Validation: rejects failureRate < 0 (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Bad Failure Rate Negative',
          method: 'GET',
          path: '/test/rate-neg',
          faultEnabled: true,
          failureMode: 'RANDOM',
          failureRate: -10,
        });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await runTest('Validation: rejects failureRate > 100 (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Bad Failure Rate High',
          method: 'GET',
          path: '/test/rate-high',
          faultEnabled: true,
          failureMode: 'RANDOM',
          failureRate: 101,
        });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await runTest('Validation: rejects failureStatusCode < 400 (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Bad Failure Status Low',
          method: 'GET',
          path: '/test/status-low',
          faultEnabled: true,
          failureMode: 'ALWAYS',
          failureStatusCode: 200, // Fault status must be error range 400-599
        });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await runTest('Validation: rejects failureStatusCode > 599 (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Bad Failure Status High',
          method: 'GET',
          path: '/test/status-high',
          faultEnabled: true,
          failureMode: 'ALWAYS',
          failureStatusCode: 600,
        });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await runTest('Validation: rejects additionalDelay < 0 (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Bad Additional Delay',
          method: 'GET',
          path: '/test/delay-neg',
          faultEnabled: true,
          additionalDelay: -100,
        });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await runTest('Validation: rejects additionalDelay > 10000 (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Bad Additional Delay High',
          method: 'GET',
          path: '/test/delay-high',
          faultEnabled: true,
          additionalDelay: 15000,
        });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await runTest('Validation: rejects invalid failureMode enum (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Bad Failure Mode',
          method: 'GET',
          path: '/test/mode-bad',
          failureMode: 'SOMETIMES',
        });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    // =============================================================
    // 2. FAULT CREATION & MULTI-TENANT ISOLATION
    // =============================================================

    await runTest('Create endpoint without fault configuration (defaults to disabled / NONE)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Healthy Normal Endpoint',
          method: 'GET',
          path: '/healthy',
          statusCode: 200,
          responseBody: { status: 'healthy', data: 'ok' },
        });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.endpoint.faultEnabled === false, 'faultEnabled must default to false');
      assert(res.body.endpoint.failureMode === 'NONE', 'failureMode must default to NONE');
      assert(res.body.endpoint.failureRate === 0, 'failureRate must default to 0');
      assert(res.body.endpoint.additionalDelay === 0, 'additionalDelay must default to 0');
      endpointNormalId = res.body.endpoint.id;
      createdEndpointIds.push(endpointNormalId);
    });

    await runTest('Create endpoint with ALWAYS failure mode and custom failure JSON', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Forced Failing Service',
          method: 'POST',
          path: '/charge',
          statusCode: 201,
          responseBody: { chargeId: 'ch_123', paid: true },
          faultEnabled: true,
          failureMode: 'ALWAYS',
          failureStatusCode: 503,
          failureResponseBody: {
            error: 'Service Unavailable',
            code: 'GATEWAY_TIMEOUT_SIMULATED',
            retryAfter: 30,
          },
        });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.endpoint.faultEnabled === true, 'faultEnabled must be true');
      assert(res.body.endpoint.failureMode === 'ALWAYS', 'failureMode must be ALWAYS');
      assert(res.body.endpoint.failureStatusCode === 503, 'failureStatusCode must be 503');
      assert(res.body.endpoint.failureResponseBody.code === 'GATEWAY_TIMEOUT_SIMULATED', 'failureResponseBody must match');
      endpointAlwaysId = res.body.endpoint.id;
      createdEndpointIds.push(endpointAlwaysId);
    });

    await runTest('Create endpoint with RANDOM failure mode and probability', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Flaky Service',
          method: 'GET',
          path: '/flaky',
          statusCode: 200,
          responseBody: { result: 'normal operation' },
          faultEnabled: true,
          failureMode: 'RANDOM',
          failureRate: 35,
          failureStatusCode: 500,
          failureResponseBody: { error: 'Intermittent internal error' },
        });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.endpoint.failureMode === 'RANDOM', 'failureMode must be RANDOM');
      assert(res.body.endpoint.failureRate === 35, 'failureRate must be 35');
      endpointRandomId = res.body.endpoint.id;
      createdEndpointIds.push(endpointRandomId);
    });

    await runTest('Create endpoint with fault configured but faultEnabled: false', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Configured But Disabled Fault',
          method: 'GET',
          path: '/disabled-fault',
          statusCode: 200,
          responseBody: { active: true },
          faultEnabled: false,
          failureMode: 'ALWAYS',
          failureStatusCode: 500,
          failureResponseBody: { error: 'Should not trigger' },
          additionalDelay: 2000,
        });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.endpoint.faultEnabled === false, 'faultEnabled must be false');
      endpointDisabledId = res.body.endpoint.id;
      createdEndpointIds.push(endpointDisabledId);
    });

    await runTest('Cross-tenant isolation: User B cannot modify User A endpoint fault config (404)', async () => {
      const res = await request(app)
        .patch(`/api/v1/endpoints/${endpointAlwaysId}`)
        .set('Cookie', userBCookie)
        .send({
          faultEnabled: false,
          failureMode: 'NONE',
        });

      assert(res.status === 404, `Expected 404 Not Found, got ${res.status}`);
    });

    // =============================================================
    // 3. MOCK RUNTIME SIMULATION TESTS
    // =============================================================

    await runTest('Mock Runtime: Endpoint without fault returns normal 200 response', async () => {
      const res = await request(app).get(`/mock/${projectAId}/healthy`);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.status === 'healthy', 'Body must match normal responseBody');
    });

    await runTest('Mock Runtime: Disabled fault (faultEnabled: false) returns normal response and no extra delay', async () => {
      const start = Date.now();
      const res = await request(app).get(`/mock/${projectAId}/disabled-fault`);
      const elapsed = Date.now() - start;

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.active === true, 'Body must be normal configured body');
      assert(elapsed < 1000, `Elapsed time should not include the 2000ms disabled additional delay, was ${elapsed}ms`);
    });

    await runTest('Mock Runtime: ALWAYS mode returns configured failure status and failure JSON body', async () => {
      const res = await request(app).post(`/mock/${projectAId}/charge`).send({ amount: 500 });

      assert(res.status === 503, `Expected 503, got ${res.status}`);
      assert(res.body.code === 'GATEWAY_TIMEOUT_SIMULATED', 'Must return failureResponseBody');
      assert(res.body.retryAfter === 30, 'Must match full custom failure payload');
    });

    await runTest('Mock Runtime: 0% failure rate in RANDOM mode NEVER produces an injected failure', async () => {
      // Configure endpoint with 0% failure rate
      const ep0Res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Zero Percent Failure',
          method: 'GET',
          path: '/zero-fail',
          statusCode: 200,
          responseBody: { zeroFailSuccess: true },
          faultEnabled: true,
          failureMode: 'RANDOM',
          failureRate: 0,
          failureStatusCode: 500,
          failureResponseBody: { error: 'Should never happen' },
        });
      assert(ep0Res.status === 201, 'Failed to create 0% failure endpoint');
      createdEndpointIds.push(ep0Res.body.endpoint.id);

      // Query multiple times: every request must succeed
      for (let i = 0; i < 5; i++) {
        const res = await request(app).get(`/mock/${projectAId}/zero-fail`);
        assert(res.status === 200, `Request ${i} failed with status ${res.status}`);
        assert(res.body.zeroFailSuccess === true, 'Response must be normal');
      }
    });

    await runTest('Mock Runtime: 100% failure rate in RANDOM mode ALWAYS produces an injected failure', async () => {
      // Configure endpoint with 100% failure rate
      const ep100Res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Hundred Percent Failure',
          method: 'GET',
          path: '/hundred-fail',
          statusCode: 200,
          responseBody: { shouldNeverReach: true },
          faultEnabled: true,
          failureMode: 'RANDOM',
          failureRate: 100,
          failureStatusCode: 502,
          failureResponseBody: { error: 'Bad Gateway Injected' },
        });
      assert(ep100Res.status === 201, 'Failed to create 100% failure endpoint');
      createdEndpointIds.push(ep100Res.body.endpoint.id);

      // Query multiple times: every request must fail
      for (let i = 0; i < 5; i++) {
        const res = await request(app).get(`/mock/${projectAId}/hundred-fail`);
        assert(res.status === 502, `Request ${i} expected 502, got ${res.status}`);
        assert(res.body.error === 'Bad Gateway Injected', 'Must return failureResponseBody');
      }
    });

    await runTest('Mock Runtime: Controlled RANDOM mode test verifies probability branching', async () => {
      // Test the mathematical branching of RANDOM mode:
      // When roll < failureRate: triggers failure
      // When roll >= failureRate: returns normal response
      const originalRandom = Math.random;
      try {
        // Mock Math.random to return 0.20 (20%) -> below 35% failureRate
        Math.random = () => 0.20;
        const failRes = await request(app).get(`/mock/${projectAId}/flaky`);
        assert(failRes.status === 500, `Expected 500 for roll below rate, got ${failRes.status}`);
        assert(failRes.body.error === 'Intermittent internal error', 'Should return failure body');

        // Mock Math.random to return 0.50 (50%) -> above 35% failureRate
        Math.random = () => 0.50;
        const okRes = await request(app).get(`/mock/${projectAId}/flaky`);
        assert(okRes.status === 200, `Expected 200 for roll above rate, got ${okRes.status}`);
        assert(okRes.body.result === 'normal operation', 'Should return normal body');
      } finally {
        Math.random = originalRandom;
      }
    });

    await runTest('Mock Runtime: Additional latency is applied correctly independently of failure mode', async () => {
      // Create endpoint with additional delay of 150ms
      const delayRes = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Latency Injection Test',
          method: 'GET',
          path: '/latency-only',
          statusCode: 200,
          responseBody: { delayed: true },
          faultEnabled: true,
          failureMode: 'NONE', // No failure, only latency injection
          additionalDelay: 150,
        });
      assert(delayRes.status === 201, 'Failed to create latency endpoint');
      createdEndpointIds.push(delayRes.body.endpoint.id);

      const start = Date.now();
      const res = await request(app).get(`/mock/${projectAId}/latency-only`);
      const elapsed = Date.now() - start;

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(elapsed >= 120, `Expected elapsed >= 120ms for 150ms delay, was ${elapsed}ms`);
    });

    await runTest('Mock Runtime: Normal responseDelay and additionalDelay combine correctly', async () => {
      // 100ms normal delay + 150ms additional delay = 250ms total delay
      const combinedRes = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Combined Latency Test',
          method: 'GET',
          path: '/combined-latency',
          statusCode: 200,
          responseDelay: 100, // Normal delay
          faultEnabled: true,
          failureMode: 'NONE',
          additionalDelay: 150, // Additional fault delay
          responseBody: { combined: true },
        });
      assert(combinedRes.status === 201, 'Failed to create combined latency endpoint');
      createdEndpointIds.push(combinedRes.body.endpoint.id);

      const start = Date.now();
      const res = await request(app).get(`/mock/${projectAId}/combined-latency`);
      const elapsed = Date.now() - start;

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(elapsed >= 200, `Expected elapsed >= 200ms for 250ms combined delay, was ${elapsed}ms`);
    });

    await runTest('Mock Runtime: Updating endpoint to disable fault restores normal behavior immediately', async () => {
      // Disable fault on endpointAlwaysId
      const updateRes = await request(app)
        .patch(`/api/v1/endpoints/${endpointAlwaysId}`)
        .set('Cookie', userACookie)
        .send({
          faultEnabled: false,
        });
      assert(updateRes.status === 200, `Expected 200, got ${updateRes.status}`);

      // Now /charge should return normal 201 with normal body
      const res = await request(app).post(`/mock/${projectAId}/charge`).send({ amount: 500 });
      assert(res.status === 201, `Expected 201 after disabling fault, got ${res.status}`);
      assert(res.body.paid === true, 'Must return normal responseBody when fault is disabled');
    });

    await runTest('Mock Runtime: Custom response headers are preserved even during injected failure', async () => {
      // Create endpoint with custom header and ALWAYS failure
      const headerFaultRes = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Header with Fault',
          method: 'GET',
          path: '/header-fault',
          statusCode: 200,
          responseHeaders: { 'X-Simulated-Region': 'us-east-1' },
          faultEnabled: true,
          failureMode: 'ALWAYS',
          failureStatusCode: 500,
          failureResponseBody: { error: 'Failed' },
        });
      assert(headerFaultRes.status === 201, 'Failed to create endpoint');
      createdEndpointIds.push(headerFaultRes.body.endpoint.id);

      const res = await request(app).get(`/mock/${projectAId}/header-fault`);
      assert(res.status === 500, `Expected 500, got ${res.status}`);
      assert(res.headers['x-simulated-region'] === 'us-east-1', 'Custom header must be present on fault response');
    });

  } finally {
    // -------------------------------------------------------------
    // Safe Isolated Cleanup: Clean up ONLY entities created by this test run
    // -------------------------------------------------------------
    try {
      if (createdUserIds.length > 0) {
        // Deleting test users cascades to workspaces, projects and endpoints in Neon PostgreSQL
        await prisma.user.deleteMany({
          where: {
            id: { in: createdUserIds },
          },
        });
      }

      if (createdEndpointIds.length > 0) {
        await prisma.mockEndpoint.deleteMany({
          where: {
            id: { in: createdEndpointIds },
          },
        });
      }

      if (createdProjectIds.length > 0) {
        await prisma.project.deleteMany({
          where: {
            id: { in: createdProjectIds },
          },
        });
      }

      if (createdWorkspaceIds.length > 0) {
        await prisma.workspace.deleteMany({
          where: {
            id: { in: createdWorkspaceIds },
          },
        });
      }
    } catch (cleanupError) {
      console.error('Warning during fault test record cleanup:', cleanupError);
    }
  }

  console.log('\n--- Test Suite Summary ---');
  const total = testResults.length;
  const passed = testResults.filter((t) => t.passed).length;
  const failed = testResults.filter((t) => !t.passed).length;

  console.log(`Total tests: ${total}`);
  console.log(`Passed:      ${passed}`);
  console.log(`Failed:      ${failed}`);

  if (failed > 0) {
    console.error('\nFault injection tests failed! Review the errors above.');
    process.exit(1);
  } else {
    console.log('\nAll Phase 5 Fault Injection tests passed successfully!');
  }
}

executeFaultTestSuite().catch((err) => {
  console.error('Fatal fault test runner error:', err);
  process.exit(1);
});

