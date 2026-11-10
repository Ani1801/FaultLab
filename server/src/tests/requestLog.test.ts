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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function executeRequestLogTestSuite() {
  console.log('--- Starting FaultLab Phase 6 Request History & Analytics Test Suite ---\n');

  // Track created entities for safe, isolated cleanup
  const createdUserIds: string[] = [];
  const createdWorkspaceIds: string[] = [];
  const createdProjectIds: string[] = [];

  const timestamp = Date.now();
  const userA = {
    name: 'Analytics Alice',
    email: `alice_analytics_${timestamp}@example.com`,
    password: 'Password123!',
  };

  const userB = {
    name: 'Intruder Bob',
    email: `bob_analytics_${timestamp}@example.com`,
    password: 'Password123!',
  };

  let userACookie: string[] = [];
  let userBCookie: string[] = [];
  let userAId = '';
  let userBId = '';

  let workspaceAId = '';
  let workspaceBId = '';
  let projectAId = '';
  let projectBId = '';

  let endpointSuccessId = '';
  let endpointFaultId = '';

  let normalLogId = '';


  try {
    // -------------------------------------------------------------
    // Test Setup: Register isolated test users, workspaces & projects
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

    const wsARes = await request(app)
      .post('/api/v1/workspaces')
      .set('Cookie', userACookie)
      .send({ name: 'Alice Analytics WS', description: 'Phase 6 Testing' });
    assert(wsARes.status === 201 && wsARes.body?.workspace?.id, 'Setup Failure: Workspace A creation');
    workspaceAId = wsARes.body.workspace.id;
    createdWorkspaceIds.push(workspaceAId);

    const wsBRes = await request(app)
      .post('/api/v1/workspaces')
      .set('Cookie', userBCookie)
      .send({ name: 'Bob Analytics WS', description: 'Phase 6 Testing' });
    assert(wsBRes.status === 201 && wsBRes.body?.workspace?.id, 'Setup Failure: Workspace B creation');
    workspaceBId = wsBRes.body.workspace.id;
    createdWorkspaceIds.push(workspaceBId);

    const projARes = await request(app)
      .post(`/api/v1/workspaces/${workspaceAId}/projects`)
      .set('Cookie', userACookie)
      .send({ name: 'Alice API Gateway', description: 'Requests testing' });
    assert(projARes.status === 201 && projARes.body?.project?.id, 'Setup Failure: Project A creation');
    projectAId = projARes.body.project.id;
    createdProjectIds.push(projectAId);

    const projBRes = await request(app)
      .post(`/api/v1/workspaces/${workspaceBId}/projects`)
      .set('Cookie', userBCookie)
      .send({ name: 'Bob Secret API', description: 'Requests testing' });
    assert(projBRes.status === 201 && projBRes.body?.project?.id, 'Setup Failure: Project B creation');
    projectBId = projBRes.body.project.id;
    createdProjectIds.push(projectBId);

    // Create 3 mock endpoints for Project A:
    // 1. Normal Success Endpoint
    const ep1Res = await request(app)
      .post(`/api/v1/projects/${projectAId}/endpoints`)
      .set('Cookie', userACookie)
      .send({
        name: 'Get Orders',
        method: 'GET',
        path: '/orders',
        statusCode: 200,
        responseBody: { orders: [{ id: 1, total: 99 }] },
      });
    assert(ep1Res.status === 201, 'Setup Failure: Endpoint 1 creation');
    endpointSuccessId = ep1Res.body.endpoint.id;

    // 2. Fault Injected Endpoint (ALWAYS 503)
    const ep2Res = await request(app)
      .post(`/api/v1/projects/${projectAId}/endpoints`)
      .set('Cookie', userACookie)
      .send({
        name: 'Checkout Service',
        method: 'POST',
        path: '/checkout',
        statusCode: 201,
        responseBody: { status: 'created' },
        faultEnabled: true,
        failureMode: 'ALWAYS',
        failureStatusCode: 503,
        failureResponseBody: { error: 'Service Unavailable', code: 'CHECKOUT_OUTAGE' },
      });
    assert(ep2Res.status === 201, 'Setup Failure: Endpoint 2 creation');
    endpointFaultId = ep2Res.body.endpoint.id;

    // 3. Delayed Endpoint (150ms delay)
    const ep3Res = await request(app)
      .post(`/api/v1/projects/${projectAId}/endpoints`)
      .set('Cookie', userACookie)
      .send({
        name: 'Slow Inventory',
        method: 'GET',
        path: '/inventory',
        statusCode: 200,
        responseDelay: 150,
        responseBody: { items: 42 },
      });
    assert(ep3Res.status === 201, 'Setup Failure: Endpoint 3 creation');
    assert(Boolean(ep3Res.body.endpoint.id), 'Endpoint 3 ID expected');

    // =============================================================
    // 1. MOCK RUNTIME LOGGING TESTS
    // =============================================================

    await runTest('Mock Runtime: Successful GET /orders creates RequestLog with status 200 and endpointId', async () => {
      const res = await request(app).get(`/mock/${projectAId}/orders`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);

      // Allow async logging to complete
      await delay(150);

      const log = await prisma.requestLog.findFirst({
        where: { projectId: projectAId, path: '/orders', method: 'GET' },
        orderBy: { createdAt: 'desc' },
      });

      assert(Boolean(log), 'Expected RequestLog to be created in database');
      assert(log!.statusCode === 200, `Expected status 200, got ${log!.statusCode}`);
      assert(log!.endpointId === endpointSuccessId, 'Expected matching endpointId');
      assert(log!.isFaultInjected === false, 'Expected isFaultInjected to be false');
      assert(log!.wasMatched === true, 'Expected wasMatched to be true');
      assert(typeof log!.responseTime === 'number' && log!.responseTime >= 0, 'Expected valid responseTime');
      assert(typeof log!.responseSize === 'number' && log!.responseSize! > 0, 'Expected responseSize > 0');

      normalLogId = log!.id;
    });

    await runTest('Mock Runtime: Fault-injected POST /checkout logs 503 and isFaultInjected: true', async () => {
      const res = await request(app)
        .post(`/mock/${projectAId}/checkout`)
        .send({ cartId: 'cart_123', amount: 99 });

      assert(res.status === 503, `Expected 503, got ${res.status}`);

      await delay(150);

      const log = await prisma.requestLog.findFirst({
        where: { projectId: projectAId, path: '/checkout', method: 'POST' },
        orderBy: { createdAt: 'desc' },
      });

      assert(Boolean(log), 'Expected RequestLog for fault-injected checkout');
      assert(log!.statusCode === 503, `Expected 503, got ${log!.statusCode}`);
      assert(log!.isFaultInjected === true, 'Expected isFaultInjected to be true');
      assert(log!.endpointId === endpointFaultId, 'Expected endpointId to match');
      assert(log!.wasMatched === true, 'Expected wasMatched to be true');
      assert(typeof log!.requestSize === 'number' && log!.requestSize! > 0, 'Expected requestSize > 0');
      assert(Boolean(log!.id), 'Expected valid log ID');
    });

    await runTest('Mock Runtime: Delayed endpoint reflects responseDelay in responseTime', async () => {
      const startTime = Date.now();
      const res = await request(app).get(`/mock/${projectAId}/inventory`);
      const elapsed = Date.now() - startTime;

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(elapsed >= 140, `Expected elapsed >= 140ms, got ${elapsed}ms`);

      await delay(150);

      const log = await prisma.requestLog.findFirst({
        where: { projectId: projectAId, path: '/inventory', method: 'GET' },
        orderBy: { createdAt: 'desc' },
      });

      assert(Boolean(log), 'Expected RequestLog for delayed endpoint');
      assert(log!.responseTime >= 140, `Expected responseTime >= 140ms, got ${log!.responseTime}`);
    });

    await runTest('Mock Runtime: Unmatched route records 404 with wasMatched: false and endpointId: null', async () => {
      const res = await request(app).get(`/mock/${projectAId}/non-existent/resource`);
      assert(res.status === 404, `Expected 404, got ${res.status}`);

      await delay(150);

      const log = await prisma.requestLog.findFirst({
        where: { projectId: projectAId, path: '/non-existent/resource', method: 'GET' },
        orderBy: { createdAt: 'desc' },
      });

      assert(Boolean(log), 'Expected RequestLog for unmatched route');
      assert(log!.statusCode === 404, `Expected 404, got ${log!.statusCode}`);
      assert(log!.wasMatched === false, 'Expected wasMatched to be false');
      assert(log!.endpointId === null, 'Expected endpointId to be null');
      assert(log!.isFaultInjected === false, 'Expected isFaultInjected to be false');
    });

    await runTest('Mock Runtime: Non-existent project returns 404 without crashing', async () => {
      const nonExistentUuid = '00000000-0000-4000-a000-000000000000';
      const res = await request(app).get(`/mock/${nonExistentUuid}/orders`);
      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    // =============================================================
    // 2. AUTHENTICATED REQUEST LOGS API TESTS
    // =============================================================

    await runTest('GET /api/v1/projects/:projectId/requests requires authentication (401)', async () => {
      const res = await request(app).get(`/api/v1/projects/${projectAId}/requests`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await runTest('GET /api/v1/projects/:projectId/requests enforces cross-tenant access control (404)', async () => {
      // Bob tries to access Alice's project requests
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/requests`)
        .set('Cookie', userBCookie);
      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    await runTest('GET /api/v1/projects/:projectId/requests returns paginated logs ordered newest first', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/requests`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.status === 'success', 'Expected status success');
      assert(Array.isArray(res.body.data), 'Expected data to be an array');
      assert(res.body.data.length >= 4, `Expected at least 4 logs, got ${res.body.data.length}`);
      assert(res.body.pagination, 'Expected pagination metadata');
      assert(res.body.pagination.page === 1, 'Expected page 1');
      assert(res.body.pagination.totalCount >= 4, 'Expected totalCount >= 4');

      // Check sorting (descending by createdAt)
      for (let i = 0; i < res.body.data.length - 1; i++) {
        const curr = new Date(res.body.data[i].createdAt).getTime();
        const next = new Date(res.body.data[i + 1].createdAt).getTime();
        assert(curr >= next, 'Expected logs ordered newest first');
      }
    });

    // =============================================================
    // 3. QUERY FILTERING TESTS
    // =============================================================

    await runTest('Filter by method: ?method=POST returns only POST logs', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/requests?method=POST`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.data.length >= 1, 'Expected at least 1 POST log');
      for (const log of res.body.data) {
        assert(log.method === 'POST', `Expected method POST, got ${log.method}`);
      }
    });

    await runTest('Filter by statusCode: ?statusCode=503 returns only 503 logs', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/requests?statusCode=503`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.data.length >= 1, 'Expected at least 1 503 log');
      for (const log of res.body.data) {
        assert(log.statusCode === 503, `Expected status 503, got ${log.statusCode}`);
      }
    });

    await runTest('Filter by faultInjected: ?faultInjected=true returns only fault injected logs', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/requests?faultInjected=true`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.data.length >= 1, 'Expected at least 1 fault injected log');
      for (const log of res.body.data) {
        assert(log.isFaultInjected === true, 'Expected isFaultInjected: true');
      }
    });

    await runTest('Filter by search: ?search=orders matches path containing "orders"', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/requests?search=orders`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.data.length >= 1, 'Expected at least 1 matching log');
      for (const log of res.body.data) {
        assert(log.path.includes('orders'), `Expected path containing "orders", got ${log.path}`);
      }
    });

    await runTest('Filter by endpointId returns only requests mapped to that endpoint', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/requests?endpointId=${endpointSuccessId}`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.data.length >= 1, 'Expected at least 1 matching log');
      for (const log of res.body.data) {
        assert(log.endpointId === endpointSuccessId, `Expected endpointId ${endpointSuccessId}, got ${log.endpointId}`);
      }
    });

    await runTest('Pagination: ?page=1&limit=2 returns exact limit and pagination metadata', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/requests?page=1&limit=2`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.data.length === 2, `Expected 2 logs, got ${res.body.data.length}`);
      assert(res.body.pagination.limit === 2, 'Expected limit 2');
      assert(res.body.pagination.hasNextPage === true, 'Expected hasNextPage to be true');
    });

    // =============================================================
    // 4. SINGLE REQUEST DETAIL TESTS
    // =============================================================

    await runTest('GET /api/v1/projects/:projectId/requests/:requestId returns single log detail', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/requests/${normalLogId}`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.status === 'success', 'Expected status success');
      assert(res.body.data.id === normalLogId, `Expected log ID ${normalLogId}, got ${res.body.data.id}`);
      assert(res.body.data.endpoint && res.body.data.endpoint.id === endpointSuccessId, 'Expected endpoint detail');
    });

    await runTest('GET /api/v1/projects/:projectId/requests/:requestId returns 404 for other user (cross-tenant)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/requests/${normalLogId}`)
        .set('Cookie', userBCookie);

      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    await runTest('GET /api/v1/projects/:projectId/requests/:requestId returns 404 for non-existent log', async () => {
      const nonExistentUuid = '00000000-0000-4000-a000-000000000000';
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/requests/${nonExistentUuid}`)
        .set('Cookie', userACookie);

      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    // =============================================================
    // 5. ANALYTICS ENGINE TESTS
    // =============================================================

    await runTest('GET /api/v1/projects/:projectId/analytics requires authentication (401)', async () => {
      const res = await request(app).get(`/api/v1/projects/${projectAId}/analytics`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await runTest('GET /api/v1/projects/:projectId/analytics cross-tenant protection (404)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/analytics`)
        .set('Cookie', userBCookie);
      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    await runTest('GET /api/v1/projects/:projectId/analytics returns accurate performance metrics', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/analytics?timeRange=24h`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.status === 'success', 'Expected status success');

      const analytics = res.body.analytics;
      assert(analytics.totalRequests >= 4, `Expected totalRequests >= 4, got ${analytics.totalRequests}`);
      assert(analytics.successfulRequests >= 2, `Expected successfulRequests >= 2, got ${analytics.successfulRequests}`);
      assert(analytics.failedRequests >= 2, `Expected failedRequests >= 2, got ${analytics.failedRequests}`); // 503 and 404
      assert(analytics.faultInjectedRequests >= 1, `Expected faultInjectedRequests >= 1, got ${analytics.faultInjectedRequests}`);
      assert(typeof analytics.successRate === 'number', 'Expected numeric successRate');
      assert(analytics.avgResponseTime > 0, 'Expected positive avgResponseTime');
      assert(analytics.minResponseTime >= 0, 'Expected non-negative minResponseTime');
      assert(analytics.maxResponseTime >= analytics.minResponseTime, 'Expected max >= min');
      assert(Array.isArray(analytics.statusBreakdown), 'Expected statusBreakdown array');
      assert(Array.isArray(analytics.methodBreakdown), 'Expected methodBreakdown array');
      assert(Array.isArray(analytics.volumeOverTime), 'Expected volumeOverTime array');
      assert(analytics.volumeOverTime.length > 0, 'Expected volumeOverTime items');
      assert(analytics.timeRange === '24h', 'Expected timeRange 24h');
    });

    await runTest('GET /api/v1/projects/:projectId/analytics supports 7d and 30d time ranges', async () => {
      const res7d = await request(app)
        .get(`/api/v1/projects/${projectAId}/analytics?timeRange=7d`)
        .set('Cookie', userACookie);
      assert(res7d.status === 200 && res7d.body.analytics.timeRange === '7d', 'Expected 7d analytics');

      const res30d = await request(app)
        .get(`/api/v1/projects/${projectAId}/analytics?timeRange=30d`)
        .set('Cookie', userACookie);
      assert(res30d.status === 200 && res30d.body.analytics.timeRange === '30d', 'Expected 30d analytics');
    });

    await runTest('GET /api/v1/projects/:projectId/analytics rejects invalid time range with 400', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/analytics?timeRange=invalid-range`)
        .set('Cookie', userACookie);

      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    // =============================================================
    // 6. CASCADE & SETNULL DELETION BEHAVIOR
    // =============================================================

    await runTest('Deleting an endpoint sets endpointId to null on associated logs (SetNull)', async () => {
      // Delete the normal success endpoint
      const delRes = await request(app)
        .delete(`/api/v1/endpoints/${endpointSuccessId}`)
        .set('Cookie', userACookie);
      assert(delRes.status === 200, `Expected 200, got ${delRes.status}`);

      // Verify log still exists but endpointId is null
      const log = await prisma.requestLog.findUnique({
        where: { id: normalLogId },
      });
      assert(Boolean(log), 'Expected log to still exist after endpoint deletion');
      assert(log!.endpointId === null, 'Expected endpointId to be set to null (SetNull)');
    });

    await runTest('Deleting a project cascades and deletes all associated request logs', async () => {
      // Delete project A
      const delRes = await request(app)
        .delete(`/api/v1/projects/${projectAId}`)
        .set('Cookie', userACookie);
      assert(delRes.status === 200, `Expected 200, got ${delRes.status}`);

      // Verify all logs for project A were cascaded
      const remainingLogs = await prisma.requestLog.count({
        where: { projectId: projectAId },
      });
      assert(remainingLogs === 0, `Expected 0 remaining logs, got ${remainingLogs}`);
    });

  } finally {
    // -------------------------------------------------------------
    // Teardown: Clean up isolated test users, workspaces & projects
    // -------------------------------------------------------------
    console.log('\n--- Cleaning up test artifacts ---');
    try {
      if (createdUserIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }
    } catch (cleanupError) {
      console.warn('Warning: Test cleanup encountered an error:', cleanupError);
    }
  }

  // -------------------------------------------------------------
  // Summary Report
  // -------------------------------------------------------------
  console.log('\n=============================================');
  console.log('Phase 6 Request History & Analytics Test Summary');
  console.log('=============================================');
  const passed = testResults.filter((t) => t.passed).length;
  const failed = testResults.filter((t) => !t.passed).length;
  console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}\n`);

  if (failed > 0) {
    console.error('Failed Tests:');
    testResults.filter((t) => !t.passed).forEach((t) => console.error(`- ${t.name}: ${t.error}`));
    process.exit(1);
  }
}

executeRequestLogTestSuite().catch((err) => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});

