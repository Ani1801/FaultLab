import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../utils/prisma.js';
import { projectService } from '../modules/projects/project.service.js';

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

async function executeProjectTestSuite() {
  console.log('--- Starting FaultLab Phase 3B Project CRUD Test Suite ---\n');

  // Track created entities for safe, isolated cleanup
  const createdUserIds: string[] = [];
  const createdWorkspaceIds: string[] = [];
  const createdProjectIds: string[] = [];

  const timestamp = Date.now();
  const userA = {
    name: 'Alice Architect',
    email: `alice_proj_${timestamp}@example.com`,
    password: 'Password123!',
  };

  const userB = {
    name: 'Bob Intruder',
    email: `bob_proj_${timestamp}@example.com`,
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

  try {
    // -------------------------------------------------------------
    // Test Setup: Register isolated test users and workspaces
    // -------------------------------------------------------------
    const regARes = await request(app).post('/api/v1/auth/register').send(userA);
    assert(
      regARes.status === 201 && Boolean(regARes.body?.user?.id),
      `Setup Failure: Could not register User A (status ${regARes.status}): ${JSON.stringify(regARes.body)}`
    );
    userACookie = regARes.headers['set-cookie'] as unknown as string[];
    userAId = regARes.body.user.id;
    createdUserIds.push(userAId);

    const regBRes = await request(app).post('/api/v1/auth/register').send(userB);
    assert(
      regBRes.status === 201 && Boolean(regBRes.body?.user?.id),
      `Setup Failure: Could not register User B (status ${regBRes.status}): ${JSON.stringify(regBRes.body)}`
    );
    userBCookie = regBRes.headers['set-cookie'] as unknown as string[];
    userBId = regBRes.body.user.id;
    createdUserIds.push(userBId);

    // Create a workspace for User A
    const wsARes = await request(app)
      .post('/api/v1/workspaces')
      .set('Cookie', userACookie)
      .send({ name: 'Alice Core Workspace' });
    assert(wsARes.status === 201 && Boolean(wsARes.body?.workspace?.id), 'Setup Failure: Could not create Workspace A');
    workspaceAId = wsARes.body.workspace.id;
    createdWorkspaceIds.push(workspaceAId);

    // Create a workspace for User B
    const wsBRes = await request(app)
      .post('/api/v1/workspaces')
      .set('Cookie', userBCookie)
      .send({ name: 'Bob Sandbox Workspace' });
    assert(wsBRes.status === 201 && Boolean(wsBRes.body?.workspace?.id), 'Setup Failure: Could not create Workspace B');
    workspaceBId = wsBRes.body.workspace.id;
    createdWorkspaceIds.push(workspaceBId);

    // -------------------------------------------------------------
    // 1. Unauthenticated Request Rejection
    // -------------------------------------------------------------
    await runTest('1. Unauthenticated requests to project endpoints are rejected with HTTP 401', async () => {
      const createRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceAId}/projects`)
        .send({ name: 'Unauthorized Project' });
      assert(createRes.status === 401, `Expected 401, got ${createRes.status}`);

      const listRes = await request(app).get(`/api/v1/workspaces/${workspaceAId}/projects`);
      assert(listRes.status === 401, `Expected 401, got ${listRes.status}`);
    });

    // -------------------------------------------------------------
    // 2. Input Validation on Project Creation
    // -------------------------------------------------------------
    await runTest('2. Reject invalid project names (missing, too short, too long, whitespace)', async () => {
      // Missing name
      const missingRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceAId}/projects`)
        .set('Cookie', userACookie)
        .send({});
      assert(missingRes.status === 400, `Expected 400 for missing name, got ${missingRes.status}`);

      // Too short (< 2 chars)
      const shortRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceAId}/projects`)
        .set('Cookie', userACookie)
        .send({ name: 'P' });
      assert(shortRes.status === 400, `Expected 400 for 1-char name, got ${shortRes.status}`);

      // Too long (> 64 chars)
      const longRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceAId}/projects`)
        .set('Cookie', userACookie)
        .send({ name: 'P'.repeat(65) });
      assert(longRes.status === 400, `Expected 400 for >64 char name, got ${longRes.status}`);

      // Description too long (> 500 chars)
      const descLongRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceAId}/projects`)
        .set('Cookie', userACookie)
        .send({ name: 'Valid Name', description: 'X'.repeat(501) });
      assert(descLongRes.status === 400, `Expected 400 for >500 char description, got ${descLongRes.status}`);
    });

    // -------------------------------------------------------------
    // 3. Reject Malformed Workspace ID
    // -------------------------------------------------------------
    await runTest('3. Reject project creation with malformed workspace ID with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/workspaces/not-a-valid-uuid/projects')
        .set('Cookie', userACookie)
        .send({ name: 'Valid Name' });
      assert(res.status === 400, `Expected 400 for malformed UUID, got ${res.status}`);
    });

    // -------------------------------------------------------------
    // 4. Reject Creation inside Foreign Workspace (Anti-IDOR: 404)
    // -------------------------------------------------------------
    await runTest('4. Reject project creation inside another user workspace with HTTP 404', async () => {
      // User B attempts to create project inside User A's workspace
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceAId}/projects`)
        .set('Cookie', userBCookie)
        .send({ name: 'Injected Project' });

      assert(res.status === 404, `Expected 404 for foreign workspace, got ${res.status}`);
    });

    // -------------------------------------------------------------
    // 5. Successful Project Creation by Workspace Owner
    // -------------------------------------------------------------
    await runTest('5. Authenticated owner can create a project with description', async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceAId}/projects`)
        .set('Cookie', userACookie)
        .send({
          name: 'Payment Service Simulator',
          description: 'Simulates payment gateway failures and webhook retries',
        });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.status === 'success', 'Response status must be success');
      assert(res.body.project?.name === 'Payment Service Simulator', 'Project name matches');
      assert(
        res.body.project?.description === 'Simulates payment gateway failures and webhook retries',
        'Description matches'
      );
      assert(res.body.project?.workspaceId === workspaceAId, 'workspaceId links to Workspace A');
      assert(Boolean(res.body.project?.id), 'Project ID generated');

      projectAId = res.body.project.id;
      createdProjectIds.push(projectAId);
    });

    // -------------------------------------------------------------
    // 6. Anti-Tampering: Unexpected fields in body are rejected
    // -------------------------------------------------------------
    await runTest('6. Strict body validation rejects attempts to inject foreign fields', async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceAId}/projects`)
        .set('Cookie', userACookie)
        .send({
          name: 'Tamper Project',
          workspaceId: workspaceBId, // Injected foreign field
        });

      assert(res.status === 400, `Expected 400 for unexpected fields, got ${res.status}`);
    });

    // -------------------------------------------------------------
    // 7. User B Creates a Project in their Workspace
    // -------------------------------------------------------------
    await runTest('7. User B can create a project in their own workspace', async () => {
      const res = await request(app)
        .post(`/api/v1/workspaces/${workspaceBId}/projects`)
        .set('Cookie', userBCookie)
        .send({
          name: 'Auth Gateway Mock',
          description: 'Simulates token expiry and auth failures',
        });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.project?.workspaceId === workspaceBId, 'Belongs to Workspace B');
      projectBId = res.body.project.id;
      createdProjectIds.push(projectBId);
    });

    // -------------------------------------------------------------
    // 8. Project Listing Isolation
    // -------------------------------------------------------------
    await runTest('8. User A lists projects and sees ONLY projects in Workspace A', async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceAId}/projects`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.count === 1, `Expected 1 project, got ${res.body.count}`);
      assert(res.body.projects[0].id === projectAId, 'User A sees project A');

      // Verify User B project is not present
      const hasB = res.body.projects.some((p: { id: string }) => p.id === projectBId);
      assert(!hasB, 'Multi-tenant isolation: Project B must not appear in Workspace A');
    });

    // -------------------------------------------------------------
    // 9. Prevent User B from Listing User A Projects
    // -------------------------------------------------------------
    await runTest('9. Non-owner cannot list projects from another user workspace (HTTP 404)', async () => {
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceAId}/projects`)
        .set('Cookie', userBCookie);

      assert(res.status === 404, `Expected 404 for foreign workspace, got ${res.status}`);
    });

    // -------------------------------------------------------------
    // 10. Single Project Detail Retrieval (GET /api/v1/projects/:id)
    // -------------------------------------------------------------
    await runTest('10. Owner can retrieve project details by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.project?.id === projectAId, 'Project ID matches');
      assert(res.body.project?.name === 'Payment Service Simulator', 'Project name matches');
      assert(Boolean(res.body.project?.createdAt), 'createdAt timestamp present');
    });

    // -------------------------------------------------------------
    // 11. Anti-IDOR: Non-owner Cannot Get Another User's Project (HTTP 404)
    // -------------------------------------------------------------
    await runTest('11. Non-owner attempting to GET project returns HTTP 404 (anti-IDOR)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}`)
        .set('Cookie', userBCookie);

      assert(res.status === 404, `Expected 404 for foreign project, got ${res.status}`);
      assert(res.body.message.includes('not found'), 'Must conceal resource existence');
    });

    // -------------------------------------------------------------
    // 12. Nonexistent Project UUID returns 404
    // -------------------------------------------------------------
    await runTest('12. Nonexistent project UUID returns HTTP 404', async () => {
      const nonExistent = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/v1/projects/${nonExistent}`)
        .set('Cookie', userACookie);

      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    // -------------------------------------------------------------
    // 13. Malformed Project ID returns 400
    // -------------------------------------------------------------
    await runTest('13. Malformed project ID returns HTTP 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/v1/projects/not-a-valid-uuid')
        .set('Cookie', userACookie);

      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    // -------------------------------------------------------------
    // 14. Owner Can Update Project Name and Description (PATCH /api/v1/projects/:id)
    // -------------------------------------------------------------
    await runTest('14. Owner can update project name and description', async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${projectAId}`)
        .set('Cookie', userACookie)
        .send({
          name: 'Payment Service Simulator v2',
          description: 'Updated failure injection scenarios',
        });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.project?.name === 'Payment Service Simulator v2', 'Name was updated');
      assert(res.body.project?.description === 'Updated failure injection scenarios', 'Description was updated');
      assert(res.body.project?.id === projectAId, 'ID unchanged');
      assert(res.body.project?.workspaceId === workspaceAId, 'workspaceId unchanged');
    });

    // -------------------------------------------------------------
    // 15. Description Clearing Behavior (null or empty string clears)
    // -------------------------------------------------------------
    await runTest('15. Passing null or empty string for description clears it in DB', async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${projectAId}`)
        .set('Cookie', userACookie)
        .send({ description: null });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.project?.description === null, 'Description must be cleared to null');

      // Verify in DB directly
      const dbRecord = await prisma.project.findUnique({ where: { id: projectAId } });
      assert(dbRecord?.description === null, 'DB record reflects null description');
    });

    // -------------------------------------------------------------
    // 16. Non-owner Cannot Update Another User's Project (HTTP 404)
    // -------------------------------------------------------------
    await runTest('16. Non-owner attempting to PATCH project returns HTTP 404', async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${projectAId}`)
        .set('Cookie', userBCookie)
        .send({ name: 'Hacked by Bob' });

      assert(res.status === 404, `Expected 404 for foreign project, got ${res.status}`);

      // Verify DB record unchanged
      const dbRecord = await prisma.project.findUnique({ where: { id: projectAId } });
      assert(dbRecord?.name === 'Payment Service Simulator v2', 'DB record must not be modified');
    });

    // -------------------------------------------------------------
    // 17. Direct Service-Level Mutation Safety (updateMany with relation filter)
    // -------------------------------------------------------------
    await runTest('17. Service-level updateProject enforces ownership via relation filter', async () => {
      let caughtError: (Error & { statusCode?: number }) | null = null;
      try {
        await projectService.updateProject(userBId, projectAId, { name: 'Direct Breach' });
      } catch (err) {
        caughtError = err as Error & { statusCode?: number };
      }

      assert(caughtError !== null, 'Expected updateProject to throw 404 for foreign user');
      assert(caughtError?.statusCode === 404, `Expected statusCode 404, got ${caughtError?.statusCode}`);
    });

    // -------------------------------------------------------------
    // 18. Non-owner Cannot Delete Another User's Project (HTTP 404)
    // -------------------------------------------------------------
    await runTest('18. Non-owner attempting to DELETE project returns HTTP 404', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${projectAId}`)
        .set('Cookie', userBCookie);

      assert(res.status === 404, `Expected 404 for foreign project, got ${res.status}`);

      // Verify project still exists in DB
      const dbRecord = await prisma.project.findUnique({ where: { id: projectAId } });
      assert(dbRecord !== null, 'Project must still exist');
    });

    // -------------------------------------------------------------
    // 19. Direct Service-Level Mutation Safety (deleteMany with relation filter)
    // -------------------------------------------------------------
    await runTest('19. Service-level deleteProject enforces ownership via relation filter', async () => {
      let caughtError: (Error & { statusCode?: number }) | null = null;
      try {
        await projectService.deleteProject(userBId, projectAId);
      } catch (err) {
        caughtError = err as Error & { statusCode?: number };
      }

      assert(caughtError !== null, 'Expected deleteProject to throw 404 for foreign user');
      assert(caughtError?.statusCode === 404, `Expected statusCode 404, got ${caughtError?.statusCode}`);
    });

    // -------------------------------------------------------------
    // 20. Owner Can Delete Project (DELETE /api/v1/projects/:id)
    // -------------------------------------------------------------
    await runTest('20. Owner can delete their project successfully (HTTP 200)', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${projectAId}`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.status === 'success', 'Response status must be success');

      // Verify project is gone from DB
      const dbRecord = await prisma.project.findUnique({ where: { id: projectAId } });
      assert(dbRecord === null, 'Project must be deleted from PostgreSQL');

      // Verify workspace is still intact
      const wsRecord = await prisma.workspace.findUnique({ where: { id: workspaceAId } });
      assert(wsRecord !== null, 'Parent workspace must remain intact');
    });

    // -------------------------------------------------------------
    // 21. Retrieving Deleted Project returns 404
    // -------------------------------------------------------------
    await runTest('21. Retrieving a deleted project returns HTTP 404', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectAId}`)
        .set('Cookie', userACookie);

      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    // -------------------------------------------------------------
    // 22. Workspace Cascade Deletion to Projects
    // -------------------------------------------------------------
    await runTest('22. Deleting a workspace cascades to and removes all its projects', async () => {
      // Create project in Workspace A
      const createRes = await request(app)
        .post(`/api/v1/workspaces/${workspaceAId}/projects`)
        .set('Cookie', userACookie)
        .send({ name: 'Ephemeral Project for Cascade Test' });
      assert(createRes.status === 201, 'Failed to create cascade project');
      const cascadeProjectId = createRes.body.project.id;
      createdProjectIds.push(cascadeProjectId);

      // Verify project exists in DB
      const beforeDelete = await prisma.project.findUnique({ where: { id: cascadeProjectId } });
      assert(beforeDelete !== null, 'Cascade project must exist prior to workspace deletion');

      // Delete parent Workspace A
      const deleteWsRes = await request(app)
        .delete(`/api/v1/workspaces/${workspaceAId}`)
        .set('Cookie', userACookie);
      assert(deleteWsRes.status === 200, 'Failed to delete workspace');

      // Verify project was cascade deleted automatically by PostgreSQL
      const afterDelete = await prisma.project.findUnique({ where: { id: cascadeProjectId } });
      assert(
        afterDelete === null,
        'PostgreSQL cascade constraint must have automatically deleted the project'
      );
    });
  } finally {
    // -------------------------------------------------------------
    // Safe Isolated Cleanup: Clean up ONLY entities created by this test run
    // -------------------------------------------------------------
    try {
      if (createdUserIds.length > 0) {
        // Deleting test users cascades to workspaces and projects
        await prisma.user.deleteMany({
          where: {
            id: { in: createdUserIds },
          },
        });
      }

      // Safeguard: explicitly delete tracked projects if any survived
      if (createdProjectIds.length > 0) {
        await prisma.project.deleteMany({
          where: {
            id: { in: createdProjectIds },
          },
        });
      }

      // Safeguard: explicitly delete tracked workspaces if any survived
      if (createdWorkspaceIds.length > 0) {
        await prisma.workspace.deleteMany({
          where: {
            id: { in: createdWorkspaceIds },
          },
        });
      }
    } catch (cleanupError) {
      console.error('Warning during project test record cleanup:', cleanupError);
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
    console.error('\nProject tests failed! Review the errors above.');
    process.exit(1);
  } else {
    console.log('\nAll 22 Project CRUD & multi-tenant isolation tests passed successfully!');
  }
}

executeProjectTestSuite().catch((err) => {
  console.error('Fatal project test runner error:', err);
  process.exit(1);
});

