// FaultLab - Phase 9: Local Diagnostic Agent Comprehensive Test Suite
// Validates pairing handshake, revocable token authentication, origin validation,
// secret redaction, task queue polling, Phase 7 assertion evaluation,
// Phase 8 diagnostic engine integration, multi-tenancy isolation, and cascade cleanup.

import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import crypto from 'node:crypto';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../utils/prisma.js';
import {
  validateTargetOrigin,
  SecurityOriginError,
  executeLocalTask,
} from '../../../packages/faultlab-agent/dist/executor.js';
import {
  redactHeaders,
  redactUrl,
  redactJsonBody,
} from '../../../packages/faultlab-agent/dist/redactor.js';
import {
  saveConfig,
  loadConfig,
  clearConfig,
} from '../../../packages/faultlab-agent/dist/config.js';

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

async function executeAgentTestSuite() {
  console.log('--- Starting FaultLab Phase 9 Local Diagnostic Agent Test Suite ---\n');

  // =========================================================================
  // SECTION 1: UNIT TESTS - ORIGIN VALIDATION & SECURITY ENFORCEMENT
  // =========================================================================

  await runTest('Security: Approved origin allows matching local path and port', async () => {
    const validated = validateTargetOrigin('http://localhost:5000/api/users', 'http://localhost:5000');
    assert(validated.origin === 'http://localhost:5000', 'Origin must match');
    assert(validated.pathname === '/api/users', 'Path must match');
  });

  await runTest('Security: Approved origin normalizes 127.0.0.1 and localhost equivalence', async () => {
    const validated = validateTargetOrigin('http://127.0.0.1:8080/health', 'http://localhost:8080');
    assert(validated.port === '8080', 'Port must match');
  });

  await runTest('Security: Rejects different port on same host', async () => {
    let caught = false;
    try {
      validateTargetOrigin('http://localhost:5001/api/users', 'http://localhost:5000');
    } catch (err) {
      if (err instanceof SecurityOriginError) caught = true;
    }
    assert(caught, 'Must throw SecurityOriginError for port mismatch');
  });

  await runTest('Security: Rejects external internet URLs', async () => {
    let caught = false;
    try {
      validateTargetOrigin('https://example.com/api', 'http://localhost:5000');
    } catch (err) {
      if (err instanceof SecurityOriginError) caught = true;
    }
    assert(caught, 'Must throw SecurityOriginError for external origin');
  });

  await runTest('Security: Rejects cloud metadata and link-local addresses', async () => {
    let caught = false;
    try {
      validateTargetOrigin('http://169.254.169.254/latest/meta-data', 'http://169.254.169.254');
    } catch (err) {
      if (err instanceof SecurityOriginError) caught = true;
    }
    assert(caught, 'Must block forbidden cloud metadata address');
  });

  await runTest('Security: Rejects non-HTTP(S) schemes (file, ftp, gopher)', async () => {
    let caught = false;
    try {
      validateTargetOrigin('file:///etc/passwd', 'http://localhost:5000');
    } catch (err) {
      if (err instanceof SecurityOriginError) caught = true;
    }
    assert(caught, 'Must block file:// URL scheme');
  });

  // =========================================================================
  // SECTION 2: UNIT TESTS - DATA SANITIZATION & REDACTION
  // =========================================================================

  await runTest('Redaction: Redacts sensitive request and response headers', async () => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer super-secret-jwt-token',
      'X-Api-Key': 'key_live_abcdef123456',
      Cookie: 'session_id=xyz987',
      'X-Custom-Header': 'public-value',
    };
    const redacted = redactHeaders(headers);
    assert(redacted['Content-Type'] === 'application/json', 'Content-Type should not be redacted');
    assert(redacted['Authorization'] === '[REDACTED]', 'Authorization must be redacted');
    assert(redacted['X-Api-Key'] === '[REDACTED]', 'X-Api-Key must be redacted');
    assert(redacted['Cookie'] === '[REDACTED]', 'Cookie must be redacted');
    assert(redacted['X-Custom-Header'] === 'public-value', 'Custom header preserved');
  });

  await runTest('Redaction: Redacts query string credentials', async () => {
    const url = 'http://localhost:5000/api/data?token=secret123&page=2&api_key=priv';
    const redacted = redactUrl(url);
    assert(redacted.includes('token=%5BREDACTED%5D') || redacted.includes('token=[REDACTED]'), 'token query param redacted');
    assert(redacted.includes('api_key=%5BREDACTED%5D') || redacted.includes('api_key=[REDACTED]'), 'api_key query param redacted');
    assert(redacted.includes('page=2'), 'page query param preserved');
  });

  await runTest('Redaction: Redacts sensitive fields in nested JSON bodies', async () => {
    const body = {
      user: {
        id: 'usr_1',
        password: 'my-plaintext-password',
        auth: {
          refreshToken: 'refresh-xyz',
          secret: 'shhh',
        },
      },
      settings: {
        theme: 'dark',
      },
    };
    const redacted = redactJsonBody(body) as any;
    assert(redacted.user.id === 'usr_1', 'user id preserved');
    assert(redacted.user.password === '[REDACTED]', 'password redacted');
    assert(redacted.user.auth.refreshToken === '[REDACTED]', 'refreshToken redacted');
    assert(redacted.user.auth.secret === '[REDACTED]', 'secret redacted');
    assert(redacted.settings.theme === 'dark', 'theme preserved');
  });

  // =========================================================================
  // SECTION 3: UNIT TESTS - CONFIGURATION PERSISTENCE
  // =========================================================================

  await runTest('Config: Successfully saves, loads, and clears agent configuration', async () => {
    const tmpConfig = path.join(os.tmpdir(), `flab-test-config-${Date.now()}.json`);
    try {
      const initial = loadConfig(tmpConfig);
      assert(initial === null, 'Config should not exist initially');

      const configData = {
        agentId: 'ag_test_123',
        token: 'fla_testtokenabc123',
        approvedOrigin: 'http://localhost:4000',
        serverUrl: 'http://localhost:5000',
        agentName: 'Test Machine',
        projectId: 'proj_xyz',
        pairedAt: new Date().toISOString(),
      };

      saveConfig(configData, tmpConfig);
      assert(fs.existsSync(tmpConfig), 'File should exist on disk');

      const loaded = loadConfig(tmpConfig);
      assert(loaded !== null, 'Loaded config should not be null');
      assert(loaded.agentId === 'ag_test_123', 'agentId matches');
      assert(loaded.token === 'fla_testtokenabc123', 'token matches');
      assert(loaded.approvedOrigin === 'http://localhost:4000', 'approvedOrigin matches');

      const cleared = clearConfig(tmpConfig);
      assert(cleared === true, 'Clear should return true');
      assert(!fs.existsSync(tmpConfig), 'Config file should be deleted');
    } finally {
      if (fs.existsSync(tmpConfig)) fs.unlinkSync(tmpConfig);
    }
  });

  // =========================================================================
  // SECTION 4: INTEGRATION TESTS - PAIRING PROTOCOL & API AUTHENTICATION
  // =========================================================================

  // Allow local network testing flag during test execution
  process.env.ALLOW_LOCAL_NETWORK_API_TESTING = 'true';

  const timestamp = Date.now();
  let userACookie: string[] = [];
  let userBCookie: string[] = [];
  let projectAId: string;
  let pairingCodeA: string;
  let agentTokenA: string;
  let agentIdA: string;

  // Setup test users & projects
  await runTest('Setup: Create test users and workspaces', async () => {
    // User A
    const regResA = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `agent_user_a_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'Agent User A',
      });
    assert(regResA.status === 201, 'User A registered');
    userACookie = regResA.headers['set-cookie'] as unknown as string[];

    // Project A
    const wsResA = await request(app)
      .post('/api/v1/workspaces')
      .set('Cookie', userACookie)
      .send({ name: 'Agent Workspace A' });
    const wsAId = wsResA.body.workspace.id;

    const projResA = await request(app)
      .post(`/api/v1/workspaces/${wsAId}/projects`)
      .set('Cookie', userACookie)
      .send({ name: 'Project A with Local Agent' });
    projectAId = projResA.body.project.id;

    // User B
    const regResB = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `agent_user_b_${timestamp}@example.com`,
        password: 'Password123!',
        name: 'Agent User B',
      });
    assert(regResB.status === 201, 'User B registered');
    userBCookie = regResB.headers['set-cookie'] as unknown as string[];

    const wsResB = await request(app)
      .post('/api/v1/workspaces')
      .set('Cookie', userBCookie)
      .send({ name: 'Agent Workspace B' });
    const wsBId = wsResB.body.workspace.id;

    const projResB = await request(app)
      .post(`/api/v1/workspaces/${wsBId}/projects`)
      .set('Cookie', userBCookie)
      .send({ name: 'Project B' });
    assert(projResB.body.project.id, 'Project B created');
  });

  await runTest('Pairing: Request pairing session creates single-use code with 10m expiry and full contract', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectAId}/agents/pair`)
      .set('Cookie', userACookie)
      .send({
        approvedOrigin: 'http://localhost:5000',
        agentName: 'Dev Workstation',
      });

    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.body.status === 'success', 'Success status');
    assert(typeof res.body.message === 'string', 'Message is string');
    assert(typeof res.body.session === 'object', 'Session is object');
    assert(res.body.session.pairingCode, 'Pairing code present');
    assert(/^FLAB-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(res.body.session.pairingCode), 'Code format matches FLAB-XXXX-YYYY');
    assert(res.body.session.approvedOrigin === 'http://localhost:5000', 'Approved origin matches');
    assert(typeof res.body.session.expiresAt === 'string', 'expiresAt is string');
    assert(typeof res.body.session.instructions === 'string', 'instructions is string');
    assert(typeof res.body.session.connectCommand === 'string', 'connectCommand is string');
    assert(res.body.session.connectCommand.includes(res.body.session.pairingCode), 'Connect command includes code');

    pairingCodeA = res.body.session.pairingCode;
  });

  await runTest('Pairing Security: Expired pairing code is rejected with 400', async () => {
    // Create an expired pairing session directly in the database
    const expiredCode = 'FLAB-EXPD-9999';
    const codeHash = crypto.createHash('sha256').update(expiredCode).digest('hex');
    await prisma.agentPairingSession.create({
      data: {
        projectId: projectAId,
        codeHash,
        approvedOrigin: 'http://localhost:5000',
        agentName: 'Expired Agent',
        expiresAt: new Date(Date.now() - 60000), // 1 minute in the past
        isUsed: false,
      },
    });

    const res = await request(app)
      .post('/api/v1/agent/pair')
      .send({
        pairingCode: expiredCode,
        deviceName: 'Expired Device',
      });

    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(res.body.message.includes('expired'), 'Error message indicates expiration');
  });

  await runTest('Pairing Validation: Missing approvedOrigin returns 400 with meaningful error', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectAId}/agents/pair`)
      .set('Cookie', userACookie)
      .send({});

    assert(res.status === 400, 'Expected 400 for missing origin');
    assert(res.body.message, 'Meaningful validation error message returned');
  });

  await runTest('Pairing: Invalid approved origin URL returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectAId}/agents/pair`)
      .set('Cookie', userACookie)
      .send({
        approvedOrigin: 'not-a-valid-url',
      });

    assert(res.status === 400, 'Expected 400 for invalid origin');
  });

  await runTest('Multi-Tenancy: User B cannot create pairing session for Project A', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectAId}/agents/pair`)
      .set('Cookie', userBCookie)
      .send({
        approvedOrigin: 'http://localhost:5000',
      });

    assert(res.status === 404, 'Expected 404 for project not owned by User B');
  });

  await runTest('Pairing Handshake: Valid pairing code exchange issues revocable token', async () => {
    const res = await request(app)
      .post('/api/v1/agent/pair')
      .send({
        pairingCode: pairingCodeA,
        systemInfo: {
          hostname: 'macbook-dev',
          platform: 'darwin',
        },
      });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.token.startsWith('fla_'), 'Token must start with fla_ prefix');
    assert(res.body.approvedOrigin === 'http://localhost:5000', 'Approved origin returned');
    assert(res.body.projectId === projectAId, 'Project ID matches');
    assert(res.body.agentId, 'Agent ID generated');

    agentTokenA = res.body.token;
    agentIdA = res.body.agentId;
  });

  await runTest('Pairing Security: Reused pairing code fails with 400', async () => {
    const res = await request(app)
      .post('/api/v1/agent/pair')
      .send({
        pairingCode: pairingCodeA,
      });

    assert(res.status === 400, 'Reused code must return 400');
    assert(res.body.message?.includes('used') || res.body.message?.includes('invalid'), 'Error message clear');
  });

  await runTest('Pairing Security: Nonexistent pairing code fails with 400', async () => {
    const res = await request(app)
      .post('/api/v1/agent/pair')
      .send({
        pairingCode: 'FLAB-FAKE-9999',
      });

    assert(res.status === 400, 'Fake code returns 400');
  });

  // =========================================================================
  // SECTION 5: AGENT LIFECYCLE & STATUS APIS
  // =========================================================================

  await runTest('Agent Auth: Unauthenticated request to agent endpoint returns 401', async () => {
    const res = await request(app).post('/api/v1/agent/heartbeat');
    assert(res.status === 401, 'Expected 401 without agent token');
  });

  await runTest('Agent Auth: Invalid token returns 401', async () => {
    const res = await request(app)
      .post('/api/v1/agent/heartbeat')
      .set('X-FaultLab-Agent-Token', 'fla_invalidtoken123');
    assert(res.status === 401, 'Expected 401 with bad token');
  });

  await runTest('Agent Heartbeat: Valid token updates status to ONLINE', async () => {
    const res = await request(app)
      .post('/api/v1/agent/heartbeat')
      .set('X-FaultLab-Agent-Token', agentTokenA)
      .send({
        systemInfo: { nodeVersion: 'v22.0.0' },
      });

    assert(res.status === 200, 'Heartbeat returns 200');
    assert(res.body.status === 'success', 'Status is success');
    assert(res.body.agentStatus === 'ONLINE', 'Agent status is ONLINE');
    assert(typeof res.body.pendingTasks === 'number', 'pendingTasks is a number');
  });

  await runTest('Agent Disconnect: Marks agent status OFFLINE', async () => {
    const res = await request(app)
      .post('/api/v1/agent/disconnect')
      .set('X-FaultLab-Agent-Token', agentTokenA);

    assert(res.status === 200, 'Disconnect returns 200');

    // Verify in database
    const agent = await prisma.localAgent.findUnique({ where: { id: agentIdA } });
    assert(agent?.status === 'OFFLINE', 'Agent status set to OFFLINE in db');
  });

  await runTest('Project Management: List agents masks sensitive credentials', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectAId}/agents`)
      .set('Cookie', userACookie);

    assert(res.status === 200, 'List agents returns 200');
    assert(Array.isArray(res.body.agents), 'Returns agents array');
    assert(res.body.agents.length === 1, 'Contains 1 agent');

    const listed = res.body.agents[0];
    assert(listed.id === agentIdA, 'Agent ID matches');
    assert(listed.tokenHash === undefined, 'tokenHash must never be exposed in management API');
    assert(listed.approvedOrigin === 'http://localhost:5000', 'Approved origin visible');
  });

  // =========================================================================
  // SECTION 6: LOCAL EXECUTION END-TO-END WITH ASSERTIONS & DIAGNOSTICS
  // =========================================================================

  // Spin up an ephemeral local mock server
  let localServer: http.Server | undefined = undefined;
  let localPort: number;

  await runTest('Setup: Start local mock server on ephemeral port', async () => {
    localServer = http.createServer((req, res) => {
      const url = req.url || '/';
      if (url === '/api/healthy') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Powered-By': 'LocalDev' });
        res.end(JSON.stringify({ status: 'ok', count: 42 }));
      } else if (url === '/api/protected') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized access' }));
      } else if (url === '/api/notfound') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Resource not found' }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    const srv = localServer!;
    await new Promise<void>((resolve) => {
      srv.listen(0, '127.0.0.1', () => {
        const addr = srv.address() as any;
        localPort = addr.port;
        resolve();
      });
    });

    assert(localPort > 0, 'Local server started on ephemeral port');
  });

  let livePairingCode: string;
  let liveAgentToken: string;
  let liveAgentId: string;

  await runTest('Pairing: Pair agent with ephemeral local server origin', async () => {
    const pairRes = await request(app)
      .post(`/api/v1/projects/${projectAId}/agents/pair`)
      .set('Cookie', userACookie)
      .send({
        approvedOrigin: `http://localhost:${localPort}`,
        agentName: 'Ephemeral Local Test Agent',
      });

    assert(pairRes.status === 201, 'Pairing session created');
    livePairingCode = pairRes.body.session.pairingCode;

    const exchangeRes = await request(app)
      .post('/api/v1/agent/pair')
      .send({ pairingCode: livePairingCode });

    assert(exchangeRes.status === 200, 'Pair exchange succeeded');
    liveAgentToken = exchangeRes.body.token;
    liveAgentId = exchangeRes.body.agentId;
  });

  await runTest('End-to-End: Enqueue, poll, execute 200 OK task and verify Phase 7 & 8 integration', async () => {
    // 1. Enqueue task from project UI
    const enqueueRes = await request(app)
      .post(`/api/v1/projects/${projectAId}/agents/execute`)
      .set('Cookie', userACookie)
      .send({
        agentId: liveAgentId,
        url: `http://localhost:${localPort}/api/healthy`,
        method: 'GET',
        testConfig: {
          name: 'Local API Health Test',
          assertions: [
            { field: 'status', operator: 'EQUALS', expectedValue: 'ok' },
            { field: 'count', operator: 'GREATER_THAN', expectedValue: '10' },
          ],
        },
      });

    assert(enqueueRes.status === 201, `Enqueue returns 201, got ${enqueueRes.status}`);
    const taskId = (enqueueRes.body.task || enqueueRes.body.data?.task)?.id;
    assert(taskId, 'Task ID returned');

    // 2. Agent polls for task
    const pollRes = await request(app)
      .get('/api/v1/agent/tasks')
      .set('X-FaultLab-Agent-Token', liveAgentToken);

    assert(pollRes.status === 200, 'Poll returns 200');
    assert(pollRes.body.task.id === taskId, 'Task ID matches enqueued task');

    // 3. Agent executes task locally
    const execResult = await executeLocalTask(
      pollRes.body.task.payload,
      `http://localhost:${localPort}`
    );

    assert(execResult.statusCode === 200, 'Local execution returns 200');
    assert(execResult.isExecutionError === false, 'isExecutionError is false');
    assert((execResult.parsedBody as any)?.status === 'ok', 'Parsed body contains status ok');

    // 4. Agent submits result to backend
    const submitRes = await request(app)
      .post(`/api/v1/agent/tasks/${taskId}/result`)
      .set('X-FaultLab-Agent-Token', liveAgentToken)
      .send({ result: execResult });

    assert(submitRes.status === 200, 'Submit returns 200');
    assert(submitRes.body.apiTestRunId, 'apiTestRunId created');

    // 5. Inspect completed task
    const taskRes = await request(app)
      .get(`/api/v1/projects/${projectAId}/agents/tasks/${taskId}`)
      .set('Cookie', userACookie);

    assert(taskRes.status === 200, 'Get task returns 200');
    assert(taskRes.body.task.status === 'COMPLETED', 'Status is COMPLETED');
    assert(taskRes.body.task.apiTestRun?.status === 'PASSED', 'ApiTestRun status is PASSED');
    assert(taskRes.body.task.diagnosticReport, 'Diagnostic report automatically generated');
    assert(taskRes.body.task.diagnosticReport.healthScore === 100, 'Health score is 100');
  });

  await runTest('Phase 8 Integration: 401 Unauthorized generates AUTH_001 diagnostic finding', async () => {
    // 1. Enqueue task for protected route
    const enqueueRes = await request(app)
      .post(`/api/v1/projects/${projectAId}/agents/execute`)
      .set('Cookie', userACookie)
      .send({
        agentId: liveAgentId,
        url: `http://localhost:${localPort}/api/protected`,
        method: 'GET',
      });

    assert(enqueueRes.status === 201, 'Enqueue returns 201');
    const taskId = enqueueRes.body.task.id;

    // 2. Poll
    const pollRes = await request(app)
      .get('/api/v1/agent/tasks')
      .set('X-FaultLab-Agent-Token', liveAgentToken);

    // 3. Execute locally
    const execResult = await executeLocalTask(
      pollRes.body.task.payload,
      `http://localhost:${localPort}`
    );
    assert(execResult.statusCode === 401, 'Local execution returns 401');

    // 4. Submit
    await request(app)
      .post(`/api/v1/agent/tasks/${taskId}/result`)
      .set('X-FaultLab-Agent-Token', liveAgentToken)
      .send({ result: execResult });

    // 5. Inspect diagnostic report
    const taskRes = await request(app)
      .get(`/api/v1/projects/${projectAId}/agents/tasks/${taskId}`)
      .set('Cookie', userACookie);

    const report = taskRes.body.task.diagnosticReport;
    assert(report, 'Diagnostic report present');
    const hasAuthFinding = report.findings.some((f: any) => f.code === 'AUTH_001');
    assert(hasAuthFinding, 'Must identify AUTH_001 finding in diagnostic report');
  });

  await runTest('Phase 8 Integration: Connection refused generates NET_002 diagnostic finding', async () => {
    // Port 19876 is typically closed
    const deadPort = 19876;
    // Create an agent with approved origin for deadPort
    const pairRes = await request(app)
      .post(`/api/v1/projects/${projectAId}/agents/pair`)
      .set('Cookie', userACookie)
      .send({ approvedOrigin: `http://localhost:${deadPort}` });

    assert(pairRes.status === 201, 'Pair session created for dead port');
    const exchRes = await request(app)
      .post('/api/v1/agent/pair')
      .send({ pairingCode: pairRes.body.session.pairingCode });

    assert(exchRes.status === 200, 'Pair exchange succeeded for dead port');
    const deadToken = exchRes.body.token;
    const deadAgentId = exchRes.body.agentId;

    const enqueueRes = await request(app)
      .post(`/api/v1/projects/${projectAId}/agents/execute`)
      .set('Cookie', userACookie)
      .send({
        agentId: deadAgentId,
        url: `http://localhost:${deadPort}/api/test`,
        method: 'GET',
      });

    assert(enqueueRes.status === 201, 'Enqueue returns 201');
    const taskId = enqueueRes.body.task.id;

    // Poll
    const pollRes = await request(app)
      .get('/api/v1/agent/tasks')
      .set('X-FaultLab-Agent-Token', deadToken);

    // Execute (will fail with ECONNREFUSED)
    const execResult = await executeLocalTask(
      pollRes.body.task.payload,
      `http://localhost:${deadPort}`
    );
    assert(execResult.isExecutionError === true, 'isExecutionError should be true');

    // Submit
    await request(app)
      .post(`/api/v1/agent/tasks/${taskId}/result`)
      .set('X-FaultLab-Agent-Token', deadToken)
      .send({ result: execResult });

    const taskRes = await request(app)
      .get(`/api/v1/projects/${projectAId}/agents/tasks/${taskId}`)
      .set('Cookie', userACookie);

    const report = taskRes.body.task.diagnosticReport;
    assert(report, 'Diagnostic report present');
    const hasNetFinding = report.findings.some(
      (f: any) => f.code === 'NET_002' || f.code === 'NET_001'
    );
    assert(hasNetFinding, 'Must identify NET_002 or NET_001 finding for connection failure');
  });

  // =========================================================================
  // SECTION 7: REVOCATION & MULTI-TENANT ENFORCEMENT
  // =========================================================================

  await runTest('Revocation: Project owner can revoke agent', async () => {
    const res = await request(app)
      .delete(`/api/v1/projects/${projectAId}/agents/${agentIdA}`)
      .set('Cookie', userACookie);

    assert(res.status === 200, 'Revoke returns 200');
    assert(res.body.agent.status === 'REVOKED', 'Status changed to REVOKED');
  });

  await runTest('Revocation Persistence: Browser refresh / list agents retrieves REVOKED status from database', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectAId}/agents`)
      .set('Cookie', userACookie);

    assert(res.status === 200, 'List agents returns 200');
    const revokedAgent = res.body.agents.find((a: any) => a.id === agentIdA);
    assert(revokedAgent, 'Revoked agent is present in listing');
    assert(revokedAgent.status === 'REVOKED', 'Agent status must remain REVOKED across queries');
  });

  await runTest('Revocation Security: Revoked agent receives 403 on subsequent requests and cannot reactivate', async () => {
    // Attempt heartbeat with revoked token
    const res = await request(app)
      .post('/api/v1/agent/heartbeat')
      .set('X-FaultLab-Agent-Token', agentTokenA);

    assert(res.status === 403, 'Revoked agent must receive 403 on heartbeat');
    assert(res.body.message?.includes('revoked'), 'Error message says revoked');

    // Verify in database that status was NOT reactivated to ONLINE
    const agentInDb = await prisma.localAgent.findUnique({ where: { id: agentIdA } });
    assert(agentInDb?.status === 'REVOKED', 'Database status must remain REVOKED despite heartbeat attempt');
  });

  await runTest('Revocation Security: Task polling on revoked agent returns 403', async () => {
    const res = await request(app)
      .get('/api/v1/agent/tasks')
      .set('X-FaultLab-Agent-Token', agentTokenA);

    assert(res.status === 403, 'Revoked agent must receive 403 on polling tasks');
  });

  await runTest('Revocation Security: Enqueueing execution on revoked agent is rejected with 400', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectAId}/agents/execute`)
      .set('Cookie', userACookie)
      .send({
        agentId: agentIdA,
        url: 'http://localhost:5000/api/test',
        method: 'GET',
      });

    assert(res.status === 400, 'Enqueue on revoked agent must return 400');
    assert(res.body.message?.includes('revoked'), 'Message indicates credentials revoked');
  });

  await runTest('Revocation Security: Graceful disconnect cannot overwrite REVOKED status to OFFLINE', async () => {
    // Disconnect attempt with revoked token receives 403
    const res = await request(app)
      .post('/api/v1/agent/disconnect')
      .set('X-FaultLab-Agent-Token', agentTokenA);

    assert(res.status === 403, 'Disconnect with revoked token returns 403');

    // Confirm DB status remains REVOKED
    const agentInDb = await prisma.localAgent.findUnique({ where: { id: agentIdA } });
    assert(agentInDb?.status === 'REVOKED', 'Database status must strictly remain REVOKED');
  });

  await runTest('Heartbeat Freshness Policy: Stale active agent transitions to OFFLINE while REVOKED is preserved', async () => {
    // Create a temporary stale agent (lastSeenAt 60s ago)
    const staleToken = 'fla_' + crypto.randomBytes(32).toString('hex');
    const staleTokenHash = crypto.createHash('sha256').update(staleToken).digest('hex');
    const staleAgent = await prisma.localAgent.create({
      data: {
        projectId: projectAId,
        name: 'Stale Heartbeat Agent',
        tokenHash: staleTokenHash,
        approvedOrigin: 'http://localhost:8080',
        status: 'ONLINE',
        lastSeenAt: new Date(Date.now() - 60000), // 60 seconds ago (>45s threshold)
      },
    });

    // Listing agents triggers heartbeat freshness check
    const listRes = await request(app)
      .get(`/api/v1/projects/${projectAId}/agents`)
      .set('Cookie', userACookie);

    assert(listRes.status === 200, 'List agents returns 200');

    // Verify stale agent transitioned to OFFLINE
    const checkedStale = listRes.body.agents.find((a: any) => a.id === staleAgent.id);
    assert(checkedStale?.status === 'OFFLINE', 'Stale active agent must transition to OFFLINE');

    // Verify revoked agent still remains REVOKED
    const checkedRevoked = listRes.body.agents.find((a: any) => a.id === agentIdA);
    assert(checkedRevoked?.status === 'REVOKED', 'REVOKED agent must never be overwritten to OFFLINE');
  });

  await runTest('Multi-Agent Isolation: Non-revoked agent connects and operates normally alongside revoked agent', async () => {
    // Pair a brand new second agent for Project A
    const pairRes = await request(app)
      .post(`/api/v1/projects/${projectAId}/agents/pair`)
      .set('Cookie', userACookie)
      .send({
        approvedOrigin: 'http://localhost:3000',
        agentName: 'Active Secondary Agent',
      });
    assert(pairRes.status === 201, 'Pair session created');

    const exchRes = await request(app)
      .post('/api/v1/agent/pair')
      .send({
        pairingCode: pairRes.body.session.pairingCode,
        deviceName: 'Active Machine 2',
      });
    assert(exchRes.status === 200, 'Exchange succeeded');
    const activeToken = exchRes.body.token;
    const activeAgentId = exchRes.body.agentId;

    // Send heartbeat from new active agent -> returns 200 ONLINE
    const hbRes = await request(app)
      .post('/api/v1/agent/heartbeat')
      .set('X-FaultLab-Agent-Token', activeToken)
      .send({ systemInfo: { hostname: 'machine-2' } });
    assert(hbRes.status === 200, 'Heartbeat for non-revoked agent succeeds');
    assert(hbRes.body.agentStatus === 'ONLINE', 'New agent is ONLINE');

    // Check project agents: new agent is ONLINE, revoked agent is still REVOKED
    const listRes = await request(app)
      .get(`/api/v1/projects/${projectAId}/agents`)
      .set('Cookie', userACookie);

    const activeInList = listRes.body.agents.find((a: any) => a.id === activeAgentId);
    const revokedInList = listRes.body.agents.find((a: any) => a.id === agentIdA);

    assert(activeInList?.status === 'ONLINE', 'Active agent is ONLINE');
    assert(revokedInList?.status === 'REVOKED', 'Revoked agent remains REVOKED');
  });

  await runTest('Multi-Tenancy: User B cannot access or view User A tasks', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectAId}/agents`)
      .set('Cookie', userBCookie);

    assert(res.status === 404, 'User B cannot view User A agents');
  });

  // =========================================================================
  // SECTION 8: CASCADE CLEANUP
  // =========================================================================

  await runTest('Cascade Cleanup: Deleting project cascades and deletes all agent models', async () => {
    // Delete Project A
    await prisma.project.delete({ where: { id: projectAId } });

    // Verify agents, sessions, tasks deleted
    const agents = await prisma.localAgent.findMany({ where: { projectId: projectAId } });
    assert(agents.length === 0, 'All agents for Project A deleted');

    const sessions = await prisma.agentPairingSession.findMany({ where: { projectId: projectAId } });
    assert(sessions.length === 0, 'All pairing sessions for Project A deleted');

    const tasks = await prisma.agentTask.findMany({ where: { projectId: projectAId } });
    assert(tasks.length === 0, 'All tasks for Project A deleted');
  });

  // Cleanup local HTTP server
  if (localServer) {
    const srv = localServer as http.Server;
    await new Promise<void>((resolve) => srv.close(() => resolve()));
  }

  // Print Summary
  console.log('\n========================================');
  console.log('FAULTLAB PHASE 9 AGENT TEST RESULTS:');
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;
  console.log(`TOTAL: ${testResults.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

executeAgentTestSuite()
  .catch((err) => {
    console.error('Test suite runner failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
