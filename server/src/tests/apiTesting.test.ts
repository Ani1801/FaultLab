import http from 'node:http';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../utils/prisma.js';
import { validateSsrfTarget } from '../modules/api-testing/ssrf.validator.js';

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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function executeApiTestingSuite() {
  console.log('--- Starting FaultLab Phase 7 Real API Testing Engine Test Suite ---\n');

  // Track created entities for safe, isolated cleanup
  const createdUserIds: string[] = [];
  const createdWorkspaceIds: string[] = [];
  const createdProjectIds: string[] = [];

  const timestamp = Date.now();
  const userA = {
    name: 'Tester Alice',
    email: `alice_testing_${timestamp}@example.com`,
    password: 'Password123!',
  };

  const userB = {
    name: 'Intruder Bob',
    email: `bob_testing_${timestamp}@example.com`,
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

  // Setup deterministic local target HTTP server for real network execution tests
  let localServer: http.Server;
  let targetBaseUrl = '';

  localServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    // Route: /echo
    if (url.pathname === '/echo') {
      let bodyStr = '';
      req.on('data', (chunk) => {
        bodyStr += chunk;
      });
      req.on('end', () => {
        let parsedBody = bodyStr;
        try {
          parsedBody = JSON.parse(bodyStr);
        } catch {}

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            method: req.method,
            headers: req.headers,
            query: Object.fromEntries(url.searchParams.entries()),
            body: parsedBody,
            status: 'ok',
            data: {
              orderId: 'ord_98765',
              amount: 5999,
              currency: 'USD',
            },
          })
        );
      });
      return;
    }

    // Route: /auth/bearer
    if (url.pathname === '/auth/bearer') {
      const auth = req.headers['authorization'];
      if (auth === 'Bearer valid_secret_token_123') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ authenticated: true, method: 'bearer' }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized bearer token' }));
      }
      return;
    }

    // Route: /auth/basic
    if (url.pathname === '/auth/basic') {
      const auth = req.headers['authorization'];
      const expected = 'Basic ' + Buffer.from('admin_user:secret_pass_456').toString('base64');
      if (auth === expected) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ authenticated: true, method: 'basic' }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized basic credentials' }));
      }
      return;
    }

    // Route: /auth/apikey
    if (url.pathname === '/auth/apikey') {
      const headerKey = req.headers['x-api-key'];
      const queryKey = url.searchParams.get('api_key');
      if (headerKey === 'secret_header_key_789' || queryKey === 'secret_query_key_789') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ authenticated: true, method: 'apikey' }));
      } else {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid API Key' }));
      }
      return;
    }

    // Route: /status/500
    if (url.pathname === '/status/500') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', code: 'SERVER_FAULT' }));
      return;
    }

    // Route: /status/204
    if (url.pathname === '/status/204') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Route: /plain-text
    if (url.pathname === '/plain-text') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Hello from plain text endpoint');
      return;
    }

    // Route: /slow
    if (url.pathname === '/slow') {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ delayed: true }));
      }, 300);
      return;
    }

    // Route: /redirect-to-ssrf
    if (url.pathname === '/redirect-to-ssrf') {
      res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data' });
      res.end();
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => {
    localServer.listen(0, '127.0.0.1', () => {
      const addr = localServer.address() as any;
      targetBaseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  // Enable local network testing flag during test execution so real requests to our local target succeed
  process.env.ALLOW_LOCAL_NETWORK_API_TESTING = 'true';

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
      .send({ name: 'Alice Testing WS', description: 'Phase 7 Testing' });
    assert(wsARes.status === 201 && wsARes.body?.workspace?.id, 'Setup Failure: Workspace A creation');
    workspaceAId = wsARes.body.workspace.id;
    createdWorkspaceIds.push(workspaceAId);

    const wsBRes = await request(app)
      .post('/api/v1/workspaces')
      .set('Cookie', userBCookie)
      .send({ name: 'Bob Testing WS', description: 'Phase 7 Testing' });
    assert(wsBRes.status === 201 && wsBRes.body?.workspace?.id, 'Setup Failure: Workspace B creation');
    workspaceBId = wsBRes.body.workspace.id;
    createdWorkspaceIds.push(workspaceBId);

    const projARes = await request(app)
      .post(`/api/v1/workspaces/${workspaceAId}/projects`)
      .set('Cookie', userACookie)
      .send({ name: 'Alice Payment Project', description: 'Real API Testing' });
    assert(projARes.status === 201 && projARes.body?.project?.id, 'Setup Failure: Project A creation');
    projectAId = projARes.body.project.id;
    createdProjectIds.push(projectAId);

    const projBRes = await request(app)
      .post(`/api/v1/workspaces/${workspaceBId}/projects`)
      .set('Cookie', userBCookie)
      .send({ name: 'Bob Secret Project', description: 'Real API Testing' });
    assert(projBRes.status === 201 && projBRes.body?.project?.id, 'Setup Failure: Project B creation');
    projectBId = projBRes.body.project.id;
    createdProjectIds.push(projectBId);

    // =============================================================
    // 1. SSRF PROTECTION & SECURITY TESTS
    // =============================================================

    await runTest('SSRF: rejects localhost and loopback IPv4 (127.0.0.1)', async () => {
      const res = await validateSsrfTarget('http://127.0.0.1:8080/test', false);
      assert(!res.isValid, 'Expected 127.0.0.1 to be blocked');
      assert(res.reason?.includes('private/restricted') || res.reason?.includes('prohibited'), 'Expected SSRF violation message');
    });

    await runTest('SSRF: rejects localhost hostname', async () => {
      const res = await validateSsrfTarget('http://localhost:5000/api/v1/health', false);
      assert(!res.isValid, 'Expected localhost to be blocked');
    });

    await runTest('SSRF: rejects private 10.0.0.0/8 address', async () => {
      const res = await validateSsrfTarget('http://10.0.0.1/admin', false);
      assert(!res.isValid, 'Expected 10.0.0.1 to be blocked');
    });

    await runTest('SSRF: rejects private 192.168.0.0/16 address', async () => {
      const res = await validateSsrfTarget('http://192.168.1.1/router-config', false);
      assert(!res.isValid, 'Expected 192.168.1.1 to be blocked');
    });

    await runTest('SSRF: rejects private 172.16.0.0/12 address', async () => {
      const res = await validateSsrfTarget('http://172.20.0.1/internal', false);
      assert(!res.isValid, 'Expected 172.20.0.1 to be blocked');
    });

    await runTest('SSRF: rejects cloud metadata endpoint (169.254.169.254)', async () => {
      const res = await validateSsrfTarget('http://169.254.169.254/latest/meta-data', false);
      assert(!res.isValid, 'Expected 169.254.169.254 to be blocked');
    });

    await runTest('SSRF: rejects cloud metadata hostname (metadata.google.internal)', async () => {
      const res = await validateSsrfTarget('http://metadata.google.internal/computeMetadata/v1/', false);
      assert(!res.isValid, 'Expected metadata.google.internal to be blocked');
    });

    await runTest('SSRF: rejects unsupported protocols (file, ftp, gopher)', async () => {
      const fileRes = await validateSsrfTarget('file:///etc/passwd', false);
      assert(!fileRes.isValid, 'Expected file:// to be rejected');

      const ftpRes = await validateSsrfTarget('ftp://ftp.example.com/file', false);
      assert(!ftpRes.isValid, 'Expected ftp:// to be rejected');
    });

    await runTest('SSRF: rejects malformed or non-parseable URLs', async () => {
      const res = await validateSsrfTarget('not-a-valid-url', false);
      assert(!res.isValid, 'Expected invalid URL format to be rejected');
    });

    await runTest('SSRF: redirects to prohibited address are intercepted and blocked', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/redirect-to-ssrf`,
        });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.run.status === 'ERROR', 'Expected test run status ERROR');
      assert(
        res.body.run.errorMessage?.includes('SSRF') || res.body.run.errorMessage?.includes('restricted'),
        `Expected SSRF error message, got: ${res.body.run.errorMessage}`
      );
    });

    // =============================================================
    // 2. REAL HTTP REQUEST EXECUTION TESTS
    // =============================================================

    await runTest('HTTP Execution: GET request with query parameters', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/echo`,
          queryParams: [
            { key: 'filter', value: 'active', enabled: true },
            { key: 'disabled_param', value: 'ignored', enabled: false },
          ],
        });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.run.actualStatusCode === 200, `Expected 200 status code, got ${res.body.run.actualStatusCode}`);
      assert(res.body.run.status === 'PASSED', 'Expected status PASSED');

      const body = JSON.parse(res.body.run.sanitizedResponseBody);
      assert(body.query.filter === 'active', 'Expected query param filter=active');
      assert(!body.query.disabled_param, 'Expected disabled_param to be excluded');
    });

    await runTest('HTTP Execution: POST request with JSON body and custom headers', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'POST',
          url: `${targetBaseUrl}/echo`,
          headers: [{ key: 'X-Client-Trace', value: 'trace-12345', enabled: true }],
          requestBody: { action: 'create_order', customerId: 'cust_999' },
        });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.run.actualStatusCode === 200, 'Expected status 200');

      const body = JSON.parse(res.body.run.sanitizedResponseBody);
      assert(body.method === 'POST', 'Expected POST method');
      assert(body.headers['x-client-trace'] === 'trace-12345', 'Expected custom header');
      assert(body.body.action === 'create_order', 'Expected request body payload');
    });

    await runTest('HTTP Execution: PUT, PATCH, DELETE requests', async () => {
      for (const verb of ['PUT', 'PATCH', 'DELETE'] as const) {
        const res = await request(app)
          .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
          .set('Cookie', userACookie)
          .send({
            method: verb,
            url: `${targetBaseUrl}/echo`,
            requestBody: { test: verb },
          });

        assert(res.status === 200, `Expected 200 for ${verb}`);
        assert(res.body.run.actualStatusCode === 200, `Expected 200 status for ${verb}`);
        const body = JSON.parse(res.body.run.sanitizedResponseBody);
        assert(body.method === verb, `Expected ${verb} method reflected`);
      }
    });

    await runTest('HTTP Execution: Bearer Authentication', async () => {
      // Valid token
      const validRes = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/auth/bearer`,
          authenticationType: 'BEARER',
          authenticationConfig: { token: 'valid_secret_token_123' },
        });

      assert(validRes.status === 200, 'Expected 200');
      assert(validRes.body.run.actualStatusCode === 200, 'Expected 200 status');

      // Invalid token
      const invalidRes = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/auth/bearer`,
          authenticationType: 'BEARER',
          authenticationConfig: { token: 'invalid_token' },
        });

      assert(invalidRes.status === 200, 'Expected 200');
      assert(invalidRes.body.run.actualStatusCode === 401, 'Expected 401 status');
    });

    await runTest('HTTP Execution: Basic Authentication', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/auth/basic`,
          authenticationType: 'BASIC',
          authenticationConfig: { username: 'admin_user', password: 'secret_pass_456' },
        });

      assert(res.status === 200, 'Expected 200');
      assert(res.body.run.actualStatusCode === 200, 'Expected 200 status');
    });

    await runTest('HTTP Execution: API Key Authentication (Header & Query)', async () => {
      // Header API key
      const headerRes = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/auth/apikey`,
          authenticationType: 'API_KEY',
          authenticationConfig: { key: 'X-API-Key', value: 'secret_header_key_789', addTo: 'HEADER' },
        });

      assert(headerRes.status === 200 && headerRes.body.run.actualStatusCode === 200, 'Expected 200 with header API key');

      // Query API key
      const queryRes = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/auth/apikey`,
          authenticationType: 'API_KEY',
          authenticationConfig: { key: 'api_key', value: 'secret_query_key_789', addTo: 'QUERY' },
        });

      assert(queryRes.status === 200 && queryRes.body.run.actualStatusCode === 200, 'Expected 200 with query API key');
    });

    await runTest('HTTP Execution: HTTP 500 received is evaluated as status 500, not a connection error', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/status/500`,
          expectedStatusCode: 500,
        });

      assert(res.status === 200, 'Expected 200 API response');
      assert(res.body.run.actualStatusCode === 500, 'Expected actualStatusCode 500');
      assert(res.body.run.status === 'PASSED', 'Expected test status PASSED because 500 was expected');
    });

    await runTest('HTTP Execution: 204 No Content empty response handled cleanly', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/status/204`,
          expectedStatusCode: 204,
        });

      assert(res.status === 200, 'Expected 200');
      assert(res.body.run.actualStatusCode === 204, 'Expected status 204');
      assert(res.body.run.status === 'PASSED', 'Expected PASSED');
    });

    await runTest('HTTP Execution: Plain text non-JSON response handled cleanly', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/plain-text`,
          expectedStatusCode: 200,
        });

      assert(res.status === 200, 'Expected 200');
      assert(res.body.run.actualStatusCode === 200, 'Expected status 200');
      assert(res.body.run.sanitizedResponseBody.includes('Hello from plain text endpoint'), 'Expected plain text content');
    });

    await runTest('HTTP Execution: Timeout enforced and results in status ERROR', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/slow`,
          timeoutMs: 100, // Shorter than 300ms server delay
        });

      assert(res.status === 200, 'Expected 200');
      assert(res.body.run.status === 'ERROR', 'Expected run status ERROR');
      assert(res.body.run.errorMessage?.includes('timed out'), 'Expected timeout error message');
    });

    // =============================================================
    // 3. ASSERTION ENGINE TESTS
    // =============================================================

    await runTest('Assertions: Expected status pass vs fail', async () => {
      // Pass case
      const passRes = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/echo`,
          expectedStatusCode: 200,
        });
      assert(passRes.body.run.status === 'PASSED', 'Expected PASSED when status matches');

      // Fail case
      const failRes = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/echo`,
          expectedStatusCode: 201, // Actual is 200
        });
      assert(failRes.body.run.status === 'FAILED', 'Expected FAILED when status differs');
      assert(failRes.body.run.assertionResults[0].passed === false, 'Expected status assertion to fail');
    });

    await runTest('Assertions: JSON field EXISTS and NOT_EXISTS', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/echo`,
          expectedResponse: [
            { field: 'data.orderId', operator: 'EXISTS' },
            { field: 'data.nonExistentField', operator: 'NOT_EXISTS' },
          ],
        });

      assert(res.body.run.status === 'PASSED', 'Expected PASSED');
      assert(res.body.run.assertionResults.length === 2, 'Expected 2 assertion results');
      assert(res.body.run.assertionResults.every((a: any) => a.passed), 'All assertions should pass');
    });

    await runTest('Assertions: JSON field EQUALS, GREATER_THAN, and CONTAINS', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/echo`,
          expectedResponse: [
            { field: 'status', operator: 'EQUALS', value: 'ok' },
            { field: 'data.amount', operator: 'GREATER_THAN', value: 5000 },
            { field: 'data.orderId', operator: 'CONTAINS', value: '98765' },
          ],
        });

      assert(res.body.run.status === 'PASSED', 'Expected PASSED');
      assert(res.body.run.assertionResults.length === 3, 'Expected 3 assertion results');
      assert(res.body.run.assertionResults.every((a: any) => a.passed), 'All assertions should pass');
    });

    await runTest('Assertions: Latency threshold maxResponseTime evaluation', async () => {
      // Pass case: max 2000ms
      const passRes = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/echo`,
          maxResponseTime: 2000,
        });
      assert(passRes.body.run.status === 'PASSED', 'Expected latency assertion to pass');

      // Fail case: max 1ms on delayed route
      const failRes = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/slow`,
          timeoutMs: 2000,
          maxResponseTime: 50, // actual is ~300ms
        });
      assert(failRes.body.run.status === 'FAILED', 'Expected latency assertion to fail');
    });

    // =============================================================
    // 4. SAVED API TESTS CRUD & OWNERSHIP ISOLATION
    // =============================================================

    let savedTestId = '';

    await runTest('Saved Tests: User A creates a saved API test with encrypted credentials', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests`)
        .set('Cookie', userACookie)
        .send({
          name: 'Payment Service Health',
          method: 'GET',
          url: `${targetBaseUrl}/echo`,
          queryParams: [{ key: 'service', value: 'payments', enabled: true }],
          authenticationType: 'BEARER',
          authenticationConfig: { token: 'secret_bearer_token_xyz' },
          expectedStatusCode: 200,
          expectedResponse: [{ field: 'status', operator: 'EQUALS', value: 'ok' }],
        });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.test.id, 'Expected created test ID');
      assert(res.body.test.hasCredentials === true, 'Expected hasCredentials: true');
      // Verify raw secrets are NEVER exposed in API response
      assert(!res.body.test.authenticationConfig, 'Secret configuration must not be returned');
      assert(!res.text.includes('secret_bearer_token_xyz'), 'Plaintext secret must never appear in response body');

      savedTestId = res.body.test.id;
    });

    await runTest('Saved Tests: User B cannot access User A saved test (404 anti-IDOR)', async () => {
      const res = await request(app)
        .get(`/api/v1/api-tests/${savedTestId}`)
        .set('Cookie', userBCookie);

      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    await runTest('Saved Tests: User B cannot run User A saved test (404)', async () => {
      const res = await request(app)
        .post(`/api/v1/api-tests/${savedTestId}/run`)
        .set('Cookie', userBCookie);

      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    await runTest('Saved Tests: User A runs saved test, asserts results, and records ApiTestRun', async () => {
      const res = await request(app)
        .post(`/api/v1/api-tests/${savedTestId}/run`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.run.status === 'PASSED', 'Expected run status PASSED');
      assert(res.body.run.actualStatusCode === 200, 'Expected status 200');
      assert(res.body.test.lastRun?.status === 'PASSED', 'Expected lastRun on test');
    });

    await runTest('Saved Tests: Retrieve test execution history (GET /api-tests/:id/runs)', async () => {
      const res = await request(app)
        .get(`/api/v1/api-tests/${savedTestId}/runs`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(Array.isArray(res.body.runs), 'Expected runs array');
      assert(res.body.runs.length >= 1, 'Expected at least 1 recorded run');
      assert(res.body.pagination, 'Expected pagination metadata');
    });

    await runTest('Saved Tests: User A updates saved test configuration', async () => {
      const res = await request(app)
        .patch(`/api/v1/api-tests/${savedTestId}`)
        .set('Cookie', userACookie)
        .send({
          name: 'Updated Payment Health Check',
          timeoutMs: 8000,
        });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.test.name === 'Updated Payment Health Check', 'Expected updated name');
      assert(res.body.test.timeoutMs === 8000, 'Expected updated timeout');
    });

    await runTest('Saved Tests: Deleting a saved test cascades to its test runs in DB', async () => {
      const delRes = await request(app)
        .delete(`/api/v1/api-tests/${savedTestId}`)
        .set('Cookie', userACookie);

      assert(delRes.status === 200, `Expected 200, got ${delRes.status}`);

      // Verify test runs are cascaded
      const remainingRuns = await prisma.apiTestRun.count({
        where: { apiTestId: savedTestId },
      });
      assert(remainingRuns === 0, 'Expected 0 remaining test runs after test deletion');
    });

    await runTest('Saved Tests: Deleting a project cascades and deletes all child API tests and runs', async () => {
      // Create a test in project B
      const createRes = await request(app)
        .post(`/api/v1/projects/${projectBId}/api-tests`)
        .set('Cookie', userBCookie)
        .send({
          name: 'Bob Temp Test',
          method: 'GET',
          url: `${targetBaseUrl}/echo`,
        });
      assert(createRes.status === 201, 'Setup failure for Bob test');

      // Delete project B
      const delProjRes = await request(app)
        .delete(`/api/v1/projects/${projectBId}`)
        .set('Cookie', userBCookie);
      assert(delProjRes.status === 200, 'Expected project deletion');

      // Verify all tests for project B were cascaded
      const testsCount = await prisma.apiTest.count({
        where: { projectId: projectBId },
      });
      assert(testsCount === 0, 'Expected 0 remaining tests for deleted project');
    });

  } finally {
    // Stop local target server
    if (localServer) {
      await new Promise<void>((resolve) => localServer.close(() => resolve()));
    }

    // Clean up test users, workspaces & projects
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

  // Summary Report
  console.log('\n=============================================');
  console.log('Phase 7 Real API Testing Engine Test Summary');
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

executeApiTestingSuite().catch((err) => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});

