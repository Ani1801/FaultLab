import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../utils/prisma.js';
import { workspaceService } from '../modules/workspaces/workspace.service.js';

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

async function executeWorkspaceTestSuite() {
  console.log('--- Starting FaultLab Phase 3A Workspace CRUD Test Suite ---\n');

  // Track created entities for safe, isolated cleanup
  const createdUserIds: string[] = [];
  const createdWorkspaceIds: string[] = [];

  const timestamp = Date.now();
  const userA = {
    name: 'Alice Developer',
    email: `alice_ws_${timestamp}@example.com`,
    password: 'Password123!',
  };

  const userB = {
    name: 'Bob Tester',
    email: `bob_ws_${timestamp}@example.com`,
    password: 'Password123!',
  };

  let userACookie: string[] = [];
  let userBCookie: string[] = [];
  let userAId: string = '';
  let userBId: string = '';

  let workspaceAId: string = '';
  let workspaceBId: string = '';

  try {
    // -------------------------------------------------------------
    // Test Setup: Register isolated test users
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

    // -------------------------------------------------------------
    // 1. Authentication Guard
    // -------------------------------------------------------------
    await runTest('1. Unauthenticated requests to /api/v1/workspaces are rejected with HTTP 401', async () => {
      const listRes = await request(app).get('/api/v1/workspaces');
      assert(listRes.status === 401, `Expected 401, got ${listRes.status}`);

      const createRes = await request(app).post('/api/v1/workspaces').send({ name: 'Unauthorized WS' });
      assert(createRes.status === 401, `Expected 401, got ${createRes.status}`);
    });

    // -------------------------------------------------------------
    // 2. Empty Workspace Listing
    // -------------------------------------------------------------
    await runTest('2. Initial workspace list for User A returns empty array with count 0', async () => {
      const res = await request(app)
        .get('/api/v1/workspaces')
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(Array.isArray(res.body.workspaces), 'Expected workspaces to be an array');
      assert(res.body.workspaces.length === 0, 'Expected length 0');
      assert(res.body.count === 0, 'Expected count 0');
    });

    // -------------------------------------------------------------
    // 3. Workspace Creation Input Validation
    // -------------------------------------------------------------
    await runTest('3. Workspace creation rejects missing, empty, or too short names with HTTP 400', async () => {
      // Missing name
      const missingRes = await request(app)
        .post('/api/v1/workspaces')
        .set('Cookie', userACookie)
        .send({});
      assert(missingRes.status === 400, `Expected 400 for missing name, got ${missingRes.status}`);

      // Too short (1 char)
      const shortRes = await request(app)
        .post('/api/v1/workspaces')
        .set('Cookie', userACookie)
        .send({ name: 'A' });
      assert(shortRes.status === 400, `Expected 400 for single char, got ${shortRes.status}`);

      // Name exceeding max length (65 chars)
      const longRes = await request(app)
        .post('/api/v1/workspaces')
        .set('Cookie', userACookie)
        .send({ name: 'A'.repeat(65) });
      assert(longRes.status === 400, `Expected 400 for long name, got ${longRes.status}`);
    });

    // -------------------------------------------------------------
    // 4. Successful Workspace Creation
    // -------------------------------------------------------------
    await runTest('4. Authenticated User A can create a workspace (POST /api/v1/workspaces)', async () => {
      const res = await request(app)
        .post('/api/v1/workspaces')
        .set('Cookie', userACookie)
        .send({ name: 'Alice Primary Workspace' });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.status === 'success', 'Expected success status');
      assert(res.body.workspace?.name === 'Alice Primary Workspace', 'Workspace name matches');
      assert(res.body.workspace?.ownerId === userAId, 'ownerId derived from authenticated user');
      assert(Boolean(res.body.workspace?.id), 'Workspace ID generated');
      workspaceAId = res.body.workspace.id;
      createdWorkspaceIds.push(workspaceAId);
    });

    // -------------------------------------------------------------
    // 5. Anti-Tampering: Injected ownerId is ignored
    // -------------------------------------------------------------
    await runTest('5. Client cannot forge or override ownerId in creation payload', async () => {
      const res = await request(app)
        .post('/api/v1/workspaces')
        .set('Cookie', userACookie)
        .send({
          name: 'Alice Sneaky Workspace',
          ownerId: userBId, // Attempting to assign to User B
        });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.workspace.ownerId === userAId, 'Server-side ownerId enforcement succeeded');
      createdWorkspaceIds.push(res.body.workspace.id);

      // Clean up this extra workspace
      await prisma.workspace.delete({ where: { id: res.body.workspace.id } });
    });

    // -------------------------------------------------------------
    // 6. User B Creates Workspace
    // -------------------------------------------------------------
    await runTest('6. Authenticated User B can create their own workspace', async () => {
      const res = await request(app)
        .post('/api/v1/workspaces')
        .set('Cookie', userBCookie)
        .send({ name: 'Bob Sandbox Workspace' });

      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.workspace?.ownerId === userBId, 'ownerId belongs to User B');
      workspaceBId = res.body.workspace.id;
      createdWorkspaceIds.push(workspaceBId);
    });

    // -------------------------------------------------------------
    // 7. Workspace Listing Multi-Tenant Isolation
    // -------------------------------------------------------------
    await runTest('7. User A lists workspaces and sees ONLY their own workspaces', async () => {
      assert(Boolean(workspaceAId && workspaceBId), 'Precondition failed: workspaces not created');
      const res = await request(app)
        .get('/api/v1/workspaces')
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.count === 1, `Expected 1 workspace, got ${res.body.count}`);
      assert(res.body.workspaces[0].id === workspaceAId, 'User A sees workspace A');

      // Ensure User B's workspace is NOT present
      const hasWorkspaceB = res.body.workspaces.some((w: { id: string }) => w.id === workspaceBId);
      assert(!hasWorkspaceB, 'Multi-tenant isolation: User A must not see User B workspaces');
    });

    await runTest('8. User B lists workspaces and sees ONLY their own workspaces', async () => {
      assert(Boolean(workspaceAId && workspaceBId), 'Precondition failed: workspaces not created');
      const res = await request(app)
        .get('/api/v1/workspaces')
        .set('Cookie', userBCookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.count === 1, `Expected 1 workspace, got ${res.body.count}`);
      assert(res.body.workspaces[0].id === workspaceBId, 'User B sees workspace B');

      // Ensure User A's workspace is NOT present
      const hasWorkspaceA = res.body.workspaces.some((w: { id: string }) => w.id === workspaceAId);
      assert(!hasWorkspaceA, 'Multi-tenant isolation: User B must not see User A workspaces');
    });

    // -------------------------------------------------------------
    // 9. Single Workspace Detail Retrieval
    // -------------------------------------------------------------
    await runTest('9. Owner (User A) can retrieve their workspace by ID (GET /:id)', async () => {
      assert(Boolean(workspaceAId), 'Precondition failed: workspaceAId is required');
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceAId}`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.workspace?.id === workspaceAId, 'Workspace ID matches');
      assert(res.body.workspace?.name === 'Alice Primary Workspace', 'Workspace name matches');
    });

    // -------------------------------------------------------------
    // 10. Anti-IDOR: Cross-Tenant Access Yields 404
    // -------------------------------------------------------------
    await runTest('10. Non-owner (User B) attempting to GET User A workspace returns HTTP 404', async () => {
      assert(Boolean(workspaceAId), 'Precondition failed: workspaceAId is required');
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceAId}`)
        .set('Cookie', userBCookie);

      assert(res.status === 404, `Expected 404 for unauthorized access, got ${res.status}`);
      assert(res.body.message.includes('not found'), 'Must not leak existence of workspace');
    });

    await runTest('11. Nonexistent workspace UUID returns HTTP 404 on GET', async () => {
      const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/v1/workspaces/${nonExistentUuid}`)
        .set('Cookie', userACookie);

      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    await runTest('12. Malformed workspace ID format returns HTTP 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/v1/workspaces/not-a-valid-uuid')
        .set('Cookie', userACookie);

      assert(res.status === 400, `Expected 400 for non-UUID, got ${res.status}`);
    });

    // -------------------------------------------------------------
    // 13. Workspace Update: Owner Success & Response Format
    // -------------------------------------------------------------
    await runTest('13. Owner (User A) can update/rename their workspace (PATCH /:id)', async () => {
      assert(Boolean(workspaceAId), 'Precondition failed: workspaceAId is required');
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceAId}`)
        .set('Cookie', userACookie)
        .send({ name: 'Alice Renamed Workspace' });

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.status === 'success', 'Response status must be success');
      assert(res.body.workspace?.name === 'Alice Renamed Workspace', 'Workspace name was updated');
      assert(res.body.workspace?.id === workspaceAId, 'Workspace ID unchanged');
      assert(res.body.workspace?.ownerId === userAId, 'ownerId unchanged');
    });

    // -------------------------------------------------------------
    // 14. Workspace Update: Non-owner Rejection (HTTP 404)
    // -------------------------------------------------------------
    await runTest('14. Non-owner (User B) attempting to PATCH User A workspace returns HTTP 404', async () => {
      assert(Boolean(workspaceAId), 'Precondition failed: workspaceAId is required');
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceAId}`)
        .set('Cookie', userBCookie)
        .send({ name: 'Hacked by Bob' });

      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    // -------------------------------------------------------------
    // 15. Verify Database Mutation Enforces Ownership on Update
    // -------------------------------------------------------------
    await runTest('15. Database record remains unmodified after foreign PATCH attempt', async () => {
      assert(Boolean(workspaceAId), 'Precondition failed: workspaceAId is required');
      const dbRecord = await prisma.workspace.findUnique({ where: { id: workspaceAId } });
      assert(dbRecord !== null, 'Workspace must still exist');
      assert(
        dbRecord.name === 'Alice Renamed Workspace',
        'Database record must NOT reflect the unauthorized update'
      );
    });

    // -------------------------------------------------------------
    // 16. Update on Nonexistent Workspace UUID returns 404
    // -------------------------------------------------------------
    await runTest('16. PATCH on nonexistent workspace UUID returns HTTP 404', async () => {
      const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .patch(`/api/v1/workspaces/${nonExistentUuid}`)
        .set('Cookie', userACookie)
        .send({ name: 'Valid Name' });

      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    // -------------------------------------------------------------
    // 17. Update Input Validation
    // -------------------------------------------------------------
    await runTest('17. Update rejects empty or whitespace-only name with HTTP 400', async () => {
      assert(Boolean(workspaceAId), 'Precondition failed: workspaceAId is required');
      const res = await request(app)
        .patch(`/api/v1/workspaces/${workspaceAId}`)
        .set('Cookie', userACookie)
        .send({ name: ' ' });

      assert(res.status === 400, `Expected 400 for empty string, got ${res.status}`);
    });

    // -------------------------------------------------------------
    // 18. Direct Service-Level Test: updateWorkspace Mutation Safety
    // -------------------------------------------------------------
    await runTest('18. Service-level updateWorkspace rejects foreign user via updateMany condition', async () => {
      assert(Boolean(workspaceAId), 'Precondition failed: workspaceAId is required');
      let caughtError: (Error & { statusCode?: number }) | null = null;
      try {
        await workspaceService.updateWorkspace(userBId, workspaceAId, { name: 'Direct Breach' });
      } catch (err) {
        caughtError = err as Error & { statusCode?: number };
      }

      assert(caughtError !== null, 'Expected updateWorkspace to throw for foreign owner');
      assert(caughtError?.statusCode === 404, `Expected statusCode 404, got ${caughtError?.statusCode}`);

      // Verify DB record unchanged
      const dbRecord = await prisma.workspace.findUnique({ where: { id: workspaceAId } });
      assert(dbRecord?.name === 'Alice Renamed Workspace', 'DB name must remain untouched');
    });

    // -------------------------------------------------------------
    // 19. Workspace Deletion: Non-owner Rejection (HTTP 404)
    // -------------------------------------------------------------
    await runTest('19. Non-owner (User B) attempting to DELETE User A workspace returns HTTP 404', async () => {
      assert(Boolean(workspaceAId), 'Precondition failed: workspaceAId is required');
      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspaceAId}`)
        .set('Cookie', userBCookie);

      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    // -------------------------------------------------------------
    // 20. Verify Database Mutation Enforces Ownership on Delete
    // -------------------------------------------------------------
    await runTest('20. Database record still exists after foreign DELETE attempt', async () => {
      assert(Boolean(workspaceAId), 'Precondition failed: workspaceAId is required');
      const dbRecord = await prisma.workspace.findUnique({ where: { id: workspaceAId } });
      assert(dbRecord !== null, 'Workspace A must still exist in DB after foreign delete attempt');
    });

    // -------------------------------------------------------------
    // 21. Deletion on Nonexistent Workspace UUID returns 404
    // -------------------------------------------------------------
    await runTest('21. DELETE on nonexistent workspace UUID returns HTTP 404', async () => {
      const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .delete(`/api/v1/workspaces/${nonExistentUuid}`)
        .set('Cookie', userACookie);

      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    // -------------------------------------------------------------
    // 22. Direct Service-Level Test: deleteWorkspace Mutation Safety
    // -------------------------------------------------------------
    await runTest('22. Service-level deleteWorkspace rejects foreign user via deleteMany condition', async () => {
      assert(Boolean(workspaceAId), 'Precondition failed: workspaceAId is required');
      let caughtError: (Error & { statusCode?: number }) | null = null;
      try {
        await workspaceService.deleteWorkspace(userBId, workspaceAId);
      } catch (err) {
        caughtError = err as Error & { statusCode?: number };
      }

      assert(caughtError !== null, 'Expected deleteWorkspace to throw for foreign owner');
      assert(caughtError?.statusCode === 404, `Expected statusCode 404, got ${caughtError?.statusCode}`);

      // Verify DB record still exists
      const dbRecord = await prisma.workspace.findUnique({ where: { id: workspaceAId } });
      assert(dbRecord !== null, 'Workspace A must remain in PostgreSQL');
    });

    // -------------------------------------------------------------
    // 23. Workspace Deletion: Owner Success
    // -------------------------------------------------------------
    await runTest('23. Owner (User A) can delete their workspace (DELETE /:id)', async () => {
      assert(Boolean(workspaceAId), 'Precondition failed: workspaceAId is required');
      const res = await request(app)
        .delete(`/api/v1/workspaces/${workspaceAId}`)
        .set('Cookie', userACookie);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.status === 'success', 'Expected success status');
    });

    // -------------------------------------------------------------
    // 24. Database State Verification after Deletion
    // -------------------------------------------------------------
    await runTest('24. Workspace is completely removed from DB while User A account remains intact', async () => {
      assert(Boolean(workspaceAId && userAId), 'Precondition failed: IDs missing');
      // Verify workspace is gone from DB
      const dbRecord = await prisma.workspace.findUnique({ where: { id: workspaceAId } });
      assert(dbRecord === null, 'Workspace must be removed from PostgreSQL');

      // Confirm User A account is completely intact
      const userARecord = await prisma.user.findUnique({ where: { id: userAId } });
      assert(Boolean(userARecord), 'User A account must remain completely intact');
    });

    // -------------------------------------------------------------
    // 25. Retrieving Deleted Workspace Returns 404
    // -------------------------------------------------------------
    await runTest('25. Retrieving a deleted workspace returns HTTP 404', async () => {
      assert(Boolean(workspaceAId), 'Precondition failed: workspaceAId is required');
      const res = await request(app)
        .get(`/api/v1/workspaces/${workspaceAId}`)
        .set('Cookie', userACookie);

      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });
  } finally {
    // -------------------------------------------------------------
    // Safe Isolated Cleanup: Clean up ONLY entities created by this test run
    // -------------------------------------------------------------
    try {
      if (createdUserIds.length > 0) {
        // Deleting test users cascades to any associated workspaces created in this run
        await prisma.user.deleteMany({
          where: {
            id: { in: createdUserIds },
          },
        });
      }

      // Safeguard: explicitly clean any workspaces that were tracked if users weren't deleted
      if (createdWorkspaceIds.length > 0) {
        await prisma.workspace.deleteMany({
          where: {
            id: { in: createdWorkspaceIds },
          },
        });
      }
    } catch (cleanupError) {
      console.error('Warning during test record cleanup:', cleanupError);
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
    console.error('\nWorkspace tests failed! Review the errors above.');
    process.exit(1);
  } else {
    console.log('\nAll 25 Workspace CRUD & multi-tenant isolation tests passed successfully!');
  }
}

executeWorkspaceTestSuite().catch((err) => {
  console.error('Fatal workspace test runner error:', err);
  process.exit(1);
});
