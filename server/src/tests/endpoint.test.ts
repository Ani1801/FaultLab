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

async function executeEndpointTestSuite() {
  console.log('--- Starting FaultLab Phase 4 Endpoint & Mock Runtime Test Suite ---\n');

  // Track created entities for safe, isolated cleanup
  const createdUserIds: string[] = [];
  const createdWorkspaceIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdEndpointIds: string[] = [];

  const timestamp = Date.now();
  const userA = {
    name: 'Alice Developer',
    email: `alice_ep_${timestamp}@example.com`,
    password: 'Password123!',
  };

  const userB = {
    name: 'Bob Intruder',
    email: `bob_ep_${timestamp}@example.com`,
    password: 'Password123!',
  };

  let userACookie: string[] = [];
  let userBCookie: string[] = [];
  let userAId: string = '';
  let userBId: string = '';

  let workspaceAId: string = '';
  let workspaceBId: string = '';
  let projectAId: string = '';
  let projectBId: string = '';

  let endpoint1Id: string = '';
  let endpointParamId: string = '';

  try {
    // -------------------------------------------------------------
    // Test Setup: Register isolated test users, workspaces & projects
    // -------------------------------------------------------------
    const regARes = await request(app).post('/api/v1/auth/register').send(userA);
    assert(
      regARes.status === 201 && Boolean(regARes.body?.user?.id),
      `Setup Failure: Could not register User A (status ${regARes.status})`
    );
    userACookie = regARes.headers['set-cookie'] as unknown as string[];
    userAId = regARes.body.user.id;
    createdUserIds.push(userAId);

    const regBRes = await request(app).post('/api/v1/auth/register').send(userB);
    assert(
      regBRes.status === 201 && Boolean(regBRes.body?.user?.id),
      `Setup Failure: Could not register User B (status ${regBRes.status})`
    );
    userBCookie = regBRes.headers['set-cookie'] as unknown as string[];
    userBId = regBRes.body.user.id;
    createdUserIds.push(userBId);

    // Create Workspace A for User A
    const wsARes = await request(app)
      .post('/api/v1/workspaces')
      .set('Cookie', userACookie)
      .send({ name: 'Alice Services Workspace' });
    assert(wsARes.status === 201 && Boolean(wsARes.body?.workspace?.id), 'Setup Failure: Could not create Workspace A');
    workspaceAId = wsARes.body.workspace.id;
    createdWorkspaceIds.push(workspaceAId);

    // Create Workspace B for User B
    const wsBRes = await request(app)
      .post('/api/v1/workspaces')
      .set('Cookie', userBCookie)
      .send({ name: 'Bob Sandbox Workspace' });
    assert(wsBRes.status === 201 && Boolean(wsBRes.body?.workspace?.id), 'Setup Failure: Could not create Workspace B');
    workspaceBId = wsBRes.body.workspace.id;
    createdWorkspaceIds.push(workspaceBId);

    // Create Project A inside Workspace A
    const projARes = await request(app)
      .post(`/api/v1/workspaces/${workspaceAId}/projects`)
      .set('Cookie', userACookie)
      .send({ name: 'Payment Gateway Service', description: 'Mock payment endpoints' });
    assert(projARes.status === 201 && Boolean(projARes.body?.project?.id), 'Setup Failure: Could not create Project A');
    projectAId = projARes.body.project.id;
    createdProjectIds.push(projectAId);

    // Create Project B inside Workspace B
    const projBRes = await request(app)
      .post(`/api/v1/workspaces/${workspaceBId}/projects`)
      .set('Cookie', userBCookie)
      .send({ name: 'Bob Secret Service', description: 'Bob isolated project' });
    assert(projBRes.status === 201 && Boolean(projBRes.body?.project?.id), 'Setup Failure: Could not create Project B');
    projectBId = projBRes.body.project.id;
    createdProjectIds.push(projectBId);

    // =============================================================
    // 1. ENDPOINT MANAGEMENT CRUD TESTS
    // =============================================================

    await runTest('Create mock endpoint: POST /api/v1/projects/:projectId/endpoints succeeds with valid data', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Get Payments List',
          method: 'GET',
          path: '/payments',
          statusCode: 200,
          responseBody: [{ id: 'pay_1', amount: 5000, currency: 'USD' }],
          responseHeaders: { 'X-Custom-Service': 'PaymentMock' },
          responseDelay: 100,
        });

      assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert(res.body.status === 'success', 'Response status must be success');
      assert(res.body.endpoint.name === 'Get Payments List', 'Endpoint name must match');
      assert(res.body.endpoint.method === 'GET', 'Method must be GET');
      assert(res.body.endpoint.path === '/payments', 'Path must be /payments');
      assert(res.body.endpoint.statusCode === 200, 'Status code must be 200');
      assert(res.body.endpoint.responseDelay === 100, 'Delay must be 100ms');

      endpoint1Id = res.body.endpoint.id;
      createdEndpointIds.push(endpoint1Id);
    });

    await runTest('Create mock endpoint: normalizes unslashed path automatically', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Create Payment',
          method: 'POST',
          path: 'payments', // no leading slash
          statusCode: 201,
          responseBody: { id: 'pay_created', status: 'approved' },
        });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.endpoint.path === '/payments', `Expected /payments, got ${res.body.endpoint.path}`);
      createdEndpointIds.push(res.body.endpoint.id);
    });

    await runTest('Create mock endpoint with route parameter: /users/:id', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Get Single User',
          method: 'GET',
          path: '/users/:id',
          statusCode: 200,
          responseBody: { id: 'dynamic_user', name: 'Simulated User', status: 'active' },
        });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      endpointParamId = res.body.endpoint.id;
      createdEndpointIds.push(endpointParamId);
    });

    await runTest('Create mock endpoint: 204 No Content with null/empty body', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Delete User Resource',
          method: 'DELETE',
          path: '/users/:id',
          statusCode: 204,
          responseBody: null,
        });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.endpoint.statusCode === 204, 'Status code must be 204');
      createdEndpointIds.push(res.body.endpoint.id);
    });

    await runTest('Reject duplicate endpoint: same method and path in same project returns 409', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Duplicate Payment Path',
          method: 'GET',
          path: '/payments',
          statusCode: 200,
        });

      assert(res.status === 409, `Expected 409 Conflict, got ${res.status}`);
    });

    await runTest('Cross-tenant isolation: User B cannot create endpoint in User A project (404)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userBCookie)
        .send({
          name: 'Intruder Endpoint',
          method: 'GET',
          path: '/hacked',
          statusCode: 200,
        });

      assert(res.status === 404, `Expected 404 Not Found, got ${res.status}`);
    });

    await runTest('List endpoints: GET /api/v1/projects/:projectId/endpoints returns endpoints for owned project', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(Array.isArray(res.body.endpoints), 'Endpoints must be an array');
      assert(res.body.count >= 4, `Expected at least 4 endpoints, got ${res.body.count}`);
    });

    await runTest('Cross-tenant isolation: User B cannot list endpoints in User A project (404)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userBCookie);

      assert(res.status === 404, `Expected 404 Not Found, got ${res.status}`);
    });

    await runTest('Get single endpoint: GET /api/v1/endpoints/:id returns endpoint details', async () => {
      const res = await request(app)
        .get(`/api/v1/endpoints/${endpoint1Id}`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.endpoint.id === endpoint1Id, 'Returned endpoint ID must match');
    });

    await runTest('Cross-tenant isolation: User B cannot retrieve User A endpoint (404)', async () => {
      const res = await request(app)
        .get(`/api/v1/endpoints/${endpoint1Id}`)
        .set('Cookie', userBCookie);

      assert(res.status === 404, `Expected 404 Not Found, got ${res.status}`);
    });

    await runTest('Update endpoint: PATCH /api/v1/endpoints/:id updates status code and body', async () => {
      const res = await request(app)
        .patch(`/api/v1/endpoints/${endpoint1Id}`)
        .set('Cookie', userACookie)
        .send({
          statusCode: 202,
          responseBody: { message: 'Updated payment list accepted' },
        });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.endpoint.statusCode === 202, 'Status code must be updated to 202');
      assert(res.body.endpoint.responseBody.message === 'Updated payment list accepted', 'Body must be updated');
    });

    await runTest('Cross-tenant isolation: User B cannot update User A endpoint (404)', async () => {
      const res = await request(app)
        .patch(`/api/v1/endpoints/${endpoint1Id}`)
        .set('Cookie', userBCookie)
        .send({ statusCode: 500 });

      assert(res.status === 404, `Expected 404 Not Found, got ${res.status}`);
    });

    await runTest('Validation: rejects invalid HTTP method (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Bad Method',
          method: 'INVALID_METHOD',
          path: '/test',
        });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await runTest('Validation: rejects invalid status code < 100 or > 599 (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Bad Status',
          method: 'GET',
          path: '/badstatus',
          statusCode: 999,
        });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await runTest('Validation: rejects negative delay (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/endpoints`)
        .set('Cookie', userACookie)
        .send({
          name: 'Bad Delay',
          method: 'GET',
          path: '/baddelay',
          responseDelay: -50,
        });

      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    // =============================================================
    // 2. MOCK RUNTIME SIMULATION TESTS (PUBLIC / UNRESTRICTED)
    // =============================================================

    await runTest('Mock Runtime: public GET /mock/:projectId/payments returns 202 and configured JSON body', async () => {
      // Note: No Cookie sent (public unauthenticated simulation)
      const res = await request(app).get(`/mock/${projectAId}/payments`);

      assert(res.status === 202, `Expected 202, got ${res.status}`);
      assert(res.body.message === 'Updated payment list accepted', 'Response body must match configured payload');
      assert(res.headers['x-custom-service'] === 'PaymentMock', 'Custom header must be returned');
    });

    await runTest('Mock Runtime: public POST /mock/:projectId/payments returns 201 and payload', async () => {
      const res = await request(app)
        .post(`/mock/${projectAId}/payments`)
        .send({ amount: 100 });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.id === 'pay_created', 'Response body must match configured payload');
    });

    await runTest('Mock Runtime: route parameter matching /mock/:projectId/users/usr_abc123 matches /users/:id', async () => {
      const res = await request(app).get(`/mock/${projectAId}/users/usr_abc123`);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.id === 'dynamic_user', 'Response body must match parameterized endpoint config');
      assert(res.body.name === 'Simulated User', 'Name must match');
    });

    await runTest('Mock Runtime: 204 No Content returns empty body', async () => {
      const res = await request(app).delete(`/mock/${projectAId}/users/usr_to_delete`);

      assert(res.status === 204, `Expected 204, got ${res.status}`);
      assert(!res.text || res.text === '', '204 response must have empty body');
    });

    await runTest('Mock Runtime: response delay delays execution without crashing', async () => {
      const start = Date.now();
      const res = await request(app).get(`/mock/${projectAId}/payments`);
      const elapsed = Date.now() - start;

      assert(res.status === 202, `Expected 202, got ${res.status}`);
      assert(elapsed >= 80, `Expected elapsed >= 80ms for 100ms delay, was ${elapsed}ms`);
    });

    await runTest('Mock Runtime: non-matching method returns 404', async () => {
      // /payments only has GET and POST configured
      const res = await request(app).put(`/mock/${projectAId}/payments`);

      assert(res.status === 404, `Expected 404, got ${res.status}`);
      assert(res.body.error === 'Mock endpoint not found', 'Must return mock not found error');
    });

    await runTest('Mock Runtime: unconfigured path returns 404', async () => {
      const res = await request(app).get(`/mock/${projectAId}/unconfigured/path`);

      assert(res.status === 404, `Expected 404, got ${res.status}`);
      assert(res.body.error === 'Mock endpoint not found', 'Must return mock not found error');
    });

    await runTest('Mock Runtime: invalid project ID format returns 404', async () => {
      const res = await request(app).get(`/mock/invalid-uuid-format/payments`);

      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    await runTest('Mock Runtime: non-existent project ID returns 404', async () => {
      const nonExistentUuid = '00000000-0000-4000-a000-000000000000';
      const res = await request(app).get(`/mock/${nonExistentUuid}/payments`);

      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    // =============================================================
    // 3. DELETION & CASCADE TESTS
    // =============================================================

    await runTest('Delete endpoint: DELETE /api/v1/endpoints/:id deletes successfully', async () => {
      const res = await request(app)
        .delete(`/api/v1/endpoints/${endpoint1Id}`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);

      // Verify it is gone from management API
      const getRes = await request(app)
        .get(`/api/v1/endpoints/${endpoint1Id}`)
        .set('Cookie', userACookie);
      assert(getRes.status === 404, 'Deleted endpoint must return 404');
    });

    await runTest('Cross-tenant isolation: User B cannot delete User A endpoint (404)', async () => {
      const res = await request(app)
        .delete(`/api/v1/endpoints/${endpointParamId}`)
        .set('Cookie', userBCookie);

      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    await runTest('Cascade delete: deleting parent project deletes all child mock endpoints in DB', async () => {
      // Verify endpoint exists in DB
      const beforeDelete = await prisma.mockEndpoint.findUnique({
        where: { id: endpointParamId },
      });
      assert(beforeDelete !== null, 'Endpoint must exist before project deletion');

      // Delete Project A
      const deleteProjRes = await request(app)
        .delete(`/api/v1/projects/${projectAId}`)
        .set('Cookie', userACookie);
      assert(deleteProjRes.status === 200, 'Project deletion must succeed');

      // Verify endpoint was cascade deleted
      const afterDelete = await prisma.mockEndpoint.findUnique({
        where: { id: endpointParamId },
      });
      assert(afterDelete === null, 'Mock endpoint must be deleted by cascade delete constraint');
    });

  } finally {
    // -------------------------------------------------------------
    // Safe Isolated Cleanup: Clean up ONLY entities created by this test run
    // -------------------------------------------------------------
    try {
      if (createdUserIds.length > 0) {
        // Deleting test users cascades to workspaces, projects and endpoints
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
      console.error('Warning during endpoint test record cleanup:', cleanupError);
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
    console.error('\nEndpoint tests failed! Review the errors above.');
    process.exit(1);
  } else {
    console.log('\nAll Phase 4 Endpoint & Mock Runtime tests passed successfully!');
  }
}

executeEndpointTestSuite().catch((err) => {
  console.error('Fatal endpoint test runner error:', err);
  process.exit(1);
});

