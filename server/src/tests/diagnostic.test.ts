// FaultLab - Phase 8: API Diagnostic Engine Comprehensive Test Suite
// Validates deterministic rule classification, severity sorting, non-blocking execution,
// database persistence, REST API endpoints, authorization isolation, and cascade cleanup.

import http from 'node:http';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../utils/prisma.js';
import { runDiagnosticEngine } from '../modules/diagnostics/diagnostic.engine.js';
import type { DiagnosticInput } from '../modules/diagnostics/diagnostic.types.js';

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

function makeDiagnosticInput(overrides: Partial<DiagnosticInput> = {}): DiagnosticInput {
  return {
    method: 'GET',
    url: 'https://api.example.com/test',
    authenticationType: 'NONE',
    isExecutionError: false,
    statusCode: 200,
    responseTime: 150,
    responseHeaders: { 'content-type': 'application/json' },
    sanitizedResponseBody: '{"status":"ok"}',
    errorMessage: null,
    assertionResults: [],
    maxResponseTime: null,
    expectedStatusCode: 200,
    timeoutMs: 5000,
    ...overrides,
  };
}

async function executeDiagnosticTestSuite() {
  console.log('--- Starting FaultLab Phase 8 API Diagnostic Engine Test Suite ---\n');

  // =========================================================================
  // SECTION 1: UNIT TESTS - DETERMINISTIC RULE ENGINE CLASSIFICATION
  // =========================================================================

  await runTest('Rule Engine: Healthy request produces HEALTHY status with 0 findings', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput());
    assert(report.overallStatus === 'HEALTHY', 'Expected HEALTHY status');
    assert(report.totalFindings === 0, 'Expected 0 findings');
    assert(report.findings.length === 0, 'Findings list should be empty');
  });

  await runTest('Rule Engine: Network - Invalid URL classified as NET_003 (HIGH)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      isExecutionError: true,
      statusCode: null,
      errorMessage: 'Invalid URL format: not-a-valid-url',
    }));
    assert(report.overallStatus === 'CRITICAL_ISSUES', 'Expected CRITICAL_ISSUES for HIGH severity finding');
    const finding = report.findings.find((f) => f.code === 'NET_003');
    assert(Boolean(finding), 'Expected NET_003 finding');
    assert(finding?.severity === 'HIGH', 'Expected HIGH severity');
    assert(finding?.category === 'NETWORK', 'Expected NETWORK category');
  });

  await runTest('Rule Engine: Network - SSRF restriction classified as NET_006 (HIGH)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      isExecutionError: true,
      statusCode: null,
      errorMessage: 'SSRF violation: target IP is a restricted private network address',
    }));
    const finding = report.findings.find((f) => f.code === 'NET_006');
    assert(Boolean(finding), 'Expected NET_006 finding');
    assert(finding?.category === 'NETWORK', 'Expected NETWORK category');
  });

  await runTest('Rule Engine: Network - Request timeout classified as NET_004 (HIGH)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      isExecutionError: true,
      statusCode: null,
      errorMessage: 'Request timeout of 5000ms exceeded',
      timeoutMs: 5000,
    }));
    const finding = report.findings.find((f) => f.code === 'NET_004');
    assert(Boolean(finding), 'Expected NET_004 finding');
    assert(finding?.explanation.includes('5000ms'), 'Explanation should mention timeout');
  });

  await runTest('Rule Engine: Network - Connection refused classified as NET_002 (HIGH)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      isExecutionError: true,
      statusCode: null,
      errorMessage: 'connect ECONNREFUSED 127.0.0.1:9999',
    }));
    const finding = report.findings.find((f) => f.code === 'NET_002');
    assert(Boolean(finding), 'Expected NET_002 finding');
  });

  await runTest('Rule Engine: Network - DNS failure classified as NET_001 (HIGH)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      isExecutionError: true,
      statusCode: null,
      errorMessage: 'getaddrinfo ENOTFOUND nonexistent.domain.invalid',
    }));
    const finding = report.findings.find((f) => f.code === 'NET_001');
    assert(Boolean(finding), 'Expected NET_001 finding');
  });

  await runTest('Rule Engine: Network - TLS certificate error classified as NET_005 (HIGH)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      isExecutionError: true,
      statusCode: null,
      errorMessage: 'certificate has expired (CERT_HAS_EXPIRED)',
    }));
    const finding = report.findings.find((f) => f.code === 'NET_005');
    assert(Boolean(finding), 'Expected NET_005 finding');
  });

  await runTest('Rule Engine: Network - Connection reset classified as NET_007 (MEDIUM)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      isExecutionError: true,
      statusCode: null,
      errorMessage: 'read ECONNRESET',
    }));
    const finding = report.findings.find((f) => f.code === 'NET_007');
    assert(Boolean(finding), 'Expected NET_007 finding');
    assert(finding?.severity === 'MEDIUM', 'Expected MEDIUM severity');
  });

  await runTest('Rule Engine: HTTP Status - 400 Bad Request classified as HTTP_400 (HIGH)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({ statusCode: 400 }));
    const finding = report.findings.find((f) => f.code === 'HTTP_400');
    assert(Boolean(finding), 'Expected HTTP_400 finding');
    assert(finding?.category === 'HTTP_STATUS', 'Expected HTTP_STATUS category');
  });

  await runTest('Rule Engine: HTTP Status - 401 with NONE auth classified as missing credentials (HIGH)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      statusCode: 401,
      authenticationType: 'NONE',
    }));
    const finding = report.findings.find((f) => f.code === 'AUTH_001');
    assert(Boolean(finding), 'Expected AUTH_001 finding');
    assert(finding?.severity === 'HIGH', 'Expected HIGH severity when unauthenticated');
    assert(finding?.category === 'AUTHENTICATION', 'Expected AUTHENTICATION category');
  });

  await runTest('Rule Engine: HTTP Status - 401 with BEARER auth classified as invalid credentials (MEDIUM)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      statusCode: 401,
      authenticationType: 'BEARER',
    }));
    const finding = report.findings.find((f) => f.code === 'AUTH_001');
    assert(Boolean(finding), 'Expected AUTH_001 finding');
    assert(finding?.severity === 'MEDIUM', 'Expected MEDIUM severity when credentials were provided');
  });

  await runTest('Rule Engine: HTTP Status - 403 Forbidden classified as AUTH_002 (HIGH)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({ statusCode: 403 }));
    const finding = report.findings.find((f) => f.code === 'AUTH_002');
    assert(Boolean(finding), 'Expected AUTH_002 finding');
  });

  await runTest('Rule Engine: HTTP Status - 404 Not Found classified as HTTP_404 (HIGH)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({ statusCode: 404 }));
    const finding = report.findings.find((f) => f.code === 'HTTP_404');
    assert(Boolean(finding), 'Expected HTTP_404 finding');
  });

  await runTest('Rule Engine: HTTP Status - 405 Method Not Allowed classified as REQ_001 (HIGH)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({ statusCode: 405 }));
    const finding = report.findings.find((f) => f.code === 'REQ_001');
    assert(Boolean(finding), 'Expected REQ_001 finding');
    assert(finding?.category === 'REQUEST_CONFIG', 'Expected REQUEST_CONFIG category');
  });

  await runTest('Rule Engine: HTTP Status - 409 Conflict classified as HTTP_409 (MEDIUM)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({ statusCode: 409 }));
    const finding = report.findings.find((f) => f.code === 'HTTP_409');
    assert(Boolean(finding), 'Expected HTTP_409 finding');
  });

  await runTest('Rule Engine: HTTP Status - 422 Unprocessable Entity generates HTTP_422 and REQ_002', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({ statusCode: 422 }));
    assert(Boolean(report.findings.find((f) => f.code === 'HTTP_422')), 'Expected HTTP_422 finding');
    assert(Boolean(report.findings.find((f) => f.code === 'REQ_002')), 'Expected REQ_002 finding');
  });

  await runTest('Rule Engine: HTTP Status - 429 Rate Limit classified as HTTP_429 (MEDIUM)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({ statusCode: 429 }));
    const finding = report.findings.find((f) => f.code === 'HTTP_429');
    assert(Boolean(finding), 'Expected HTTP_429 finding');
  });

  await runTest('Rule Engine: HTTP Status - 500, 502, 503, 504 server errors classified correctly', async () => {
    const r500 = runDiagnosticEngine(makeDiagnosticInput({ statusCode: 500 }));
    assert(Boolean(r500.findings.find((f) => f.code === 'HTTP_500')), 'Expected HTTP_500');

    const r502 = runDiagnosticEngine(makeDiagnosticInput({ statusCode: 502 }));
    assert(Boolean(r502.findings.find((f) => f.code === 'HTTP_502')), 'Expected HTTP_502');

    const r503 = runDiagnosticEngine(makeDiagnosticInput({ statusCode: 503 }));
    assert(Boolean(r503.findings.find((f) => f.code === 'HTTP_503')), 'Expected HTTP_503');

    const r504 = runDiagnosticEngine(makeDiagnosticInput({ statusCode: 504 }));
    assert(Boolean(r504.findings.find((f) => f.code === 'HTTP_504')), 'Expected HTTP_504');
  });

  await runTest('Rule Engine: Security - Basic auth over unencrypted HTTP flagged as AUTH_003 (HIGH)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      url: 'http://insecure-api.internal/endpoint',
      authenticationType: 'BASIC',
      statusCode: 200,
    }));
    const finding = report.findings.find((f) => f.code === 'AUTH_003');
    assert(Boolean(finding), 'Expected AUTH_003 finding');
    assert(finding?.severity === 'HIGH', 'Expected HIGH severity');
  });

  await runTest('Rule Engine: Response - Content-Type JSON but invalid body syntax flagged as RESP_001 (MEDIUM)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      statusCode: 200,
      responseHeaders: { 'content-type': 'application/json' },
      sanitizedResponseBody: '<html><body>Internal Server Error</body></html>',
    }));
    const finding = report.findings.find((f) => f.code === 'RESP_001');
    assert(Boolean(finding), 'Expected RESP_001 finding');
    assert(finding?.category === 'RESPONSE', 'Expected RESPONSE category');
  });

  await runTest('Rule Engine: Response - Empty body on 200 OK flagged as RESP_002 (LOW)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      statusCode: 200,
      sanitizedResponseBody: '',
    }));
    const finding = report.findings.find((f) => f.code === 'RESP_002');
    assert(Boolean(finding), 'Expected RESP_002 finding');
    assert(finding?.severity === 'LOW', 'Expected LOW severity');
  });

  await runTest('Rule Engine: Performance - Latency exceeding user-configured threshold flagged as PERF_001 (HIGH)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      responseTime: 3500,
      maxResponseTime: 2000,
    }));
    const finding = report.findings.find((f) => f.code === 'PERF_001');
    assert(Boolean(finding), 'Expected PERF_001 finding');
    assert(finding?.severity === 'HIGH', 'Expected HIGH severity');
  });

  await runTest('Rule Engine: Performance - Latency >5000ms without threshold flagged as PERF_002 (MEDIUM)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      responseTime: 5400,
      maxResponseTime: null,
    }));
    const finding = report.findings.find((f) => f.code === 'PERF_002');
    assert(Boolean(finding), 'Expected PERF_002 finding');
    assert(finding?.severity === 'MEDIUM', 'Expected MEDIUM severity');
  });

  await runTest('Rule Engine: Performance - Latency >2000ms and <=5000ms flagged as PERF_003 (LOW)', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      responseTime: 2800,
      maxResponseTime: null,
    }));
    const finding = report.findings.find((f) => f.code === 'PERF_003');
    assert(Boolean(finding), 'Expected PERF_003 finding');
    assert(finding?.severity === 'LOW', 'Expected LOW severity');
  });

  await runTest('Rule Engine: Assertion - Failed assertions categorized correctly', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      assertionResults: [
        {
          name: 'HTTP Status Code',
          type: 'STATUS_CODE',
          expected: 200,
          actual: 500,
          passed: false,
          message: 'Expected status 200, but received 500',
        },
        {
          name: 'Response Latency Threshold',
          type: 'RESPONSE_TIME',
          expected: '<=1000ms',
          actual: '2500ms',
          passed: false,
          message: 'Response time of 2500ms exceeded maximum allowed threshold of 1000ms',
        },
        {
          name: 'JSON Body: data.token EXISTS',
          type: 'JSON_BODY',
          expected: 'EXISTS',
          actual: null,
          passed: false,
          message: 'Field "data.token" does not exist in response',
        },
      ],
    }));

    assert(Boolean(report.findings.find((f) => f.code === 'ASSERT_STATUS')), 'Expected ASSERT_STATUS');
    assert(Boolean(report.findings.find((f) => f.code === 'ASSERT_LATENCY')), 'Expected ASSERT_LATENCY');
    assert(Boolean(report.findings.find((f) => f.code === 'ASSERT_JSON')), 'Expected ASSERT_JSON');
  });

  await runTest('Rule Engine: Severity Sorting - Findings ordered CRITICAL > HIGH > MEDIUM > LOW > INFO', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      statusCode: 400, // HIGH
      responseTime: 2500, // LOW (PERF_003)
      sanitizedResponseBody: '', // LOW (RESP_002)
    }));
    assert(report.findings.length >= 2, 'Should have multiple findings');
    // First finding should have severity HIGH
    assert(report.findings[0]?.severity === 'HIGH', 'First finding must be highest severity (HIGH)');
  });

  await runTest('Rule Engine: Overall Status - CRITICAL_ISSUES assigned if any finding is HIGH/CRITICAL', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({ statusCode: 500 }));
    assert(report.overallStatus === 'CRITICAL_ISSUES', 'Expected CRITICAL_ISSUES');
  });

  await runTest('Rule Engine: Overall Status - WARNING assigned if highest severity is MEDIUM', async () => {
    const report = runDiagnosticEngine(makeDiagnosticInput({
      statusCode: 429, // HTTP_429 is MEDIUM
    }));
    assert(report.overallStatus === 'WARNING', 'Expected WARNING status');
  });

  // =========================================================================
  // SECTION 2: INTEGRATION TESTS - DATABASE PERSISTENCE, RUNS, REST ENDPOINTS
  // =========================================================================

  const createdUserIds: string[] = [];
  const timestamp = Date.now();

  const userA = {
    name: 'Diagnostic Tester Alice',
    email: `alice_diag_${timestamp}@example.com`,
    password: 'Password123!',
  };

  const userB = {
    name: 'Diagnostic Intruder Bob',
    email: `bob_diag_${timestamp}@example.com`,
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

  // Setup deterministic local HTTP server
  let localServer: http.Server;
  let targetBaseUrl = '';

  localServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (url.pathname === '/ok') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', data: { id: 101, name: 'Alice' } }));
      return;
    }

    if (url.pathname === '/server-error') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', code: 'DB_DOWN' }));
      return;
    }

    if (url.pathname === '/rate-limited') {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
      res.end(JSON.stringify({ error: 'Too Many Requests' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  await new Promise<void>((resolve) => {
    localServer.listen(0, '127.0.0.1', () => {
      const addr = localServer.address();
      if (typeof addr === 'object' && addr !== null) {
        targetBaseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  // Enable local network testing flag during test execution so real requests to our local target succeed
  process.env.ALLOW_LOCAL_NETWORK_API_TESTING = 'true';

  try {
    // 1. Setup User A
    await runTest('Integration Setup: Register and authenticate User A', async () => {
      const regRes = await request(app).post('/api/v1/auth/register').send(userA);
      assert(regRes.status === 201, `Registration failed: ${regRes.body?.message}`);
      userAId = regRes.body.user.id;
      createdUserIds.push(userAId);
      userACookie = regRes.headers['set-cookie'] as unknown as string[];

      const wsRes = await request(app)
        .post('/api/v1/workspaces')
        .set('Cookie', userACookie)
        .send({ name: 'Alice Workspace' });
      assert(wsRes.status === 201, 'Workspace creation failed');
      workspaceAId = wsRes.body.workspace.id;

      const projRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceAId}/projects`)
        .set('Cookie', userACookie)
        .send({ name: 'Alice Diagnostics Project' });
      assert(projRes.status === 201, 'Project creation failed');
      projectAId = projRes.body.project.id;
    });

    // 2. Setup User B
    await runTest('Integration Setup: Register and authenticate User B', async () => {
      const regRes = await request(app).post('/api/v1/auth/register').send(userB);
      assert(regRes.status === 201, 'User B registration failed');
      userBId = regRes.body.user.id;
      createdUserIds.push(userBId);
      userBCookie = regRes.headers['set-cookie'] as unknown as string[];

      const wsRes = await request(app)
        .post('/api/v1/workspaces')
        .set('Cookie', userBCookie)
        .send({ name: 'Bob Workspace' });
      assert(wsRes.status === 201, 'Bob workspace creation failed');
      workspaceBId = wsRes.body.workspace.id;

      const projRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceBId}/projects`)
        .set('Cookie', userBCookie)
        .send({ name: 'Bob Project' });
      assert(projRes.status === 201, 'Bob project creation failed');
      projectBId = projRes.body.project.id;
      assert(Boolean(projectBId), 'Bob project ID should be present');
    });

    let savedHealthyTestId = '';
    let savedFailingTestId = '';
    let healthyRunId = '';
    let failingRunId = '';

    // 3. Saved Test Execution with HEALTHY diagnostic
    await runTest('Integration: Executing saved healthy test persists ApiDiagnosticReport with HEALTHY status', async () => {
      const testRes = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests`)
        .set('Cookie', userACookie)
        .send({
          name: 'Healthy Test',
          method: 'GET',
          url: `${targetBaseUrl}/ok`,
          expectedStatusCode: 200,
        });
      assert(testRes.status === 201, 'Test creation failed');
      savedHealthyTestId = testRes.body.test.id;

      const runRes = await request(app)
        .post(`/api/v1/api-tests/${savedHealthyTestId}/run`)
        .set('Cookie', userACookie);
      assert(runRes.status === 200, `Run failed: ${runRes.body?.message}`);
      healthyRunId = runRes.body.run.id;

      // Check run response includes diagnosticReport
      assert(Boolean(runRes.body.run.diagnosticReport), 'Expected diagnosticReport in run response');
      assert(runRes.body.run.diagnosticReport.overallStatus === 'HEALTHY', 'Expected HEALTHY status');

      // Verify report was persisted in database
      const dbReport = await prisma.apiDiagnosticReport.findUnique({
        where: { apiTestRunId: healthyRunId },
      });
      assert(Boolean(dbReport), 'Expected ApiDiagnosticReport in DB');
      assert(dbReport?.overallStatus === 'HEALTHY', 'Expected DB record to have HEALTHY status');
      assert(dbReport?.projectId === projectAId, 'Expected report to be associated with projectAId');
    });

    // 4. Saved Test Execution with FAILING / CRITICAL diagnostic
    await runTest('Integration: Executing failing test persists ApiDiagnosticReport with CRITICAL_ISSUES status', async () => {
      const testRes = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests`)
        .set('Cookie', userACookie)
        .send({
          name: 'Failing Test',
          method: 'GET',
          url: `${targetBaseUrl}/server-error`,
          expectedStatusCode: 200,
        });
      assert(testRes.status === 201, 'Test creation failed');
      savedFailingTestId = testRes.body.test.id;

      const runRes = await request(app)
        .post(`/api/v1/api-tests/${savedFailingTestId}/run`)
        .set('Cookie', userACookie);
      assert(runRes.status === 200, 'Run failed');
      failingRunId = runRes.body.run.id;

      assert(Boolean(runRes.body.run.diagnosticReport), 'Expected diagnosticReport in run response');
      assert(
        runRes.body.run.diagnosticReport.overallStatus === 'CRITICAL_ISSUES',
        'Expected CRITICAL_ISSUES for 500 status'
      );
      assert(
        runRes.body.run.diagnosticReport.findings.some((f: any) => f.code === 'HTTP_500'),
        'Expected HTTP_500 finding'
      );

      const dbReport = await prisma.apiDiagnosticReport.findUnique({
        where: { apiTestRunId: failingRunId },
      });
      assert(dbReport?.overallStatus === 'CRITICAL_ISSUES', 'Expected DB record CRITICAL_ISSUES');
    });

    // 5. Ephemeral test execution without saving (saveRun: false)
    await runTest('Integration: Ephemeral unsaved test returns diagnostic inline but does NOT persist to DB', async () => {
      const initialCount = await prisma.apiDiagnosticReport.count();

      const execRes = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/ok`,
          saveRun: false,
        });
      assert(execRes.status === 200, 'Ephemeral test execution failed');
      assert(Boolean(execRes.body.run.diagnosticReport), 'Expected inline diagnosticReport in response');
      assert(execRes.body.run.id === 'ephemeral-run', 'Expected ephemeral run ID');

      const finalCount = await prisma.apiDiagnosticReport.count();
      assert(finalCount === initialCount, 'Ephemeral run must not create DB diagnostic records');
    });

    // 6. Ephemeral test execution with saving (saveRun: true)
    await runTest('Integration: Unsaved test with saveRun=true persists ApiDiagnosticReport to DB', async () => {
      const execRes = await request(app)
        .post(`/api/v1/projects/${projectAId}/api-tests/execute`)
        .set('Cookie', userACookie)
        .send({
          method: 'GET',
          url: `${targetBaseUrl}/rate-limited`,
          saveRun: true,
        });
      assert(execRes.status === 200, 'Execution with saveRun failed');
      const persistedRunId = execRes.body.run.id;
      assert(persistedRunId !== 'ephemeral-run', 'Expected persisted run ID');

      const dbReport = await prisma.apiDiagnosticReport.findUnique({
        where: { apiTestRunId: persistedRunId },
      });
      assert(Boolean(dbReport), 'Expected ApiDiagnosticReport persisted in DB');
      assert(dbReport?.overallStatus === 'WARNING', 'Expected WARNING status for 429');
    });

    // 7. GET /api/v1/api-test-runs/:runId/diagnostics
    await runTest('API: GET /api-test-runs/:runId/diagnostics returns report for valid run', async () => {
      const res = await request(app)
        .get(`/api/v1/api-test-runs/${healthyRunId}/diagnostics`)
        .set('Cookie', userACookie);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.status === 'success', 'Expected success status');
      assert(res.body.diagnostic.overallStatus === 'HEALTHY', 'Expected HEALTHY status');
    });

    // 8. Cross-User Authorization: User B cannot access User A's test run diagnostics
    await runTest('Security: User B cannot access User A run diagnostics (returns 404)', async () => {
      const res = await request(app)
        .get(`/api/v1/api-test-runs/${healthyRunId}/diagnostics`)
        .set('Cookie', userBCookie);
      assert(res.status === 404, `Expected 404 for unauthorized diagnostic access, got ${res.status}`);
    });

    // 9. GET /api/v1/projects/:projectId/diagnostics
    await runTest('API: GET /projects/:projectId/diagnostics lists project diagnostic reports', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/diagnostics`)
        .set('Cookie', userACookie);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(Array.isArray(res.body.diagnostics), 'Expected diagnostics array');
      assert(res.body.diagnostics.length >= 2, 'Expected at least 2 reports');
      assert(Boolean(res.body.pagination), 'Expected pagination object');
    });

    // 10. Filter project diagnostics by status
    await runTest('API: GET /projects/:projectId/diagnostics filters by overallStatus', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/diagnostics?overallStatus=CRITICAL_ISSUES`)
        .set('Cookie', userACookie);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(
        res.body.diagnostics.every((d: any) => d.overallStatus === 'CRITICAL_ISSUES'),
        'All returned items must match the requested filter status'
      );
    });

    // 11. GET /api/v1/projects/:projectId/diagnostics/summary
    await runTest('API: GET /projects/:projectId/diagnostics/summary returns aggregated counts', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}/diagnostics/summary`)
        .set('Cookie', userACookie);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const summary = res.body.summary;
      assert(typeof summary.total === 'number' && summary.total >= 2, 'Expected total >= 2');
      assert(typeof summary.healthy === 'number' && summary.healthy >= 1, 'Expected healthy >= 1');
      assert(typeof summary.criticalIssues === 'number' && summary.criticalIssues >= 1, 'Expected criticalIssues >= 1');
    });

    // 12. Security: User B cannot access User A's project diagnostics or summary
    await runTest('Security: User B cannot access User A project diagnostics or summary (404)', async () => {
      const listRes = await request(app)
        .get(`/api/v1/projects/${projectAId}/diagnostics`)
        .set('Cookie', userBCookie);
      assert(listRes.status === 404, `Expected 404 for project diagnostics, got ${listRes.status}`);

      const sumRes = await request(app)
        .get(`/api/v1/projects/${projectAId}/diagnostics/summary`)
        .set('Cookie', userBCookie);
      assert(sumRes.status === 404, `Expected 404 for project summary, got ${sumRes.status}`);
    });

    // 13. Cascade Deletion: Deleting project deletes all its diagnostic reports
    await runTest('Cascade: Deleting project deletes associated ApiDiagnosticReport records', async () => {
      const beforeCount = await prisma.apiDiagnosticReport.count({
        where: { projectId: projectAId },
      });
      assert(beforeCount > 0, 'Expected positive count before deletion');

      const delRes = await request(app)
        .delete(`/api/v1/projects/${projectAId}`)
        .set('Cookie', userACookie);
      assert(delRes.status === 200, 'Project deletion failed');

      const afterCount = await prisma.apiDiagnosticReport.count({
        where: { projectId: projectAId },
      });
      assert(afterCount === 0, 'Expected 0 diagnostic reports after project cascade deletion');
    });

  } finally {
    if (localServer) {
      await new Promise<void>((resolve) => localServer.close(() => resolve()));
    }

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

  // Final Summary Report
  console.log('\n=============================================');
  console.log('Phase 8 API Diagnostic Engine Test Summary');
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

executeDiagnosticTestSuite().catch((err) => {
  console.error('Fatal error during diagnostic test suite execution:', err);
  process.exit(1);
});
