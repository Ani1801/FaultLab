import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { prisma } from '../utils/prisma.js';
import { env } from '../config/env.js';

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

async function executeTestSuite() {
  console.log('--- Starting FaultLab Phase 2 Authentication Test Suite ---\n');

  const timestamp = Date.now();
  const testUser = {
    name: 'Auth Test User',
    email: `test_user_${timestamp}@example.com`,
    password: 'SecurePassword123!',
  };

  let sessionCookie: string[] = [];

  try {
    // 1. Health check still works
  await runTest('1. Health check endpoint remains operational (GET /api/v1/health)', async () => {
    const res = await request(app).get('/api/v1/health');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.status === 'healthy', 'Expected status to be healthy');
    assert(res.body.database?.status === 'connected', 'Expected database to be connected');
  });

  // 2. Successful Registration
  await runTest('2. Successful registration creates user and sets HttpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.status === 'success', 'Expected status success');
    assert(res.body.user?.email === testUser.email.toLowerCase(), 'Email matches normalized email');
    assert(Boolean(res.body.user?.id), 'User ID generated');

    const cookies = res.headers['set-cookie'];
    assert(Boolean(cookies && cookies.length > 0), 'Set-Cookie header present');
    const authCookie = (cookies as unknown as string[]).find((c) => c.startsWith(`${env.COOKIE_NAME}=`));
    assert(Boolean(authCookie), `Cookie ${env.COOKIE_NAME} not found`);
    assert(authCookie!.includes('HttpOnly'), 'Cookie must be HttpOnly');
    assert(authCookie!.includes('SameSite=Lax') || authCookie!.includes('samesite=lax'), 'Cookie must be SameSite=Lax');
    sessionCookie = cookies as unknown as string[];
  });

  // 3. Password hash is NEVER returned
  await runTest('3. Password hash is never returned in API responses', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.user.passwordHash === undefined, 'passwordHash must not exist in user object');
    assert(res.body.user.password === undefined, 'password must not exist in user object');
    assert(!JSON.stringify(res.body).includes('passwordHash'), 'Raw JSON must not contain passwordHash');
  });

  // 4. Duplicate email registration rejected
  await runTest('4. Duplicate email registration returns HTTP 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    assert(res.status === 409, `Expected 409, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.status === 'error', 'Expected error status');
    assert(res.body.message.includes('already exists'), 'Expected conflict message');
  });

  // 5. Invalid email rejected
  await runTest('5. Invalid email format returns HTTP 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Invalid Email',
        email: 'not-an-email',
        password: 'SecurePassword123!',
      });

    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(res.body.status === 'error', 'Expected error status');
  });

  // 6. Weak password rejected
  await runTest('6. Weak password (missing number/uppercase) returns HTTP 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Weak Pass',
        email: `weak_${timestamp}@example.com`,
        password: 'weakpassword',
      });

    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(res.body.status === 'error', 'Expected error status');
  });

  // 7. Successful login
  await runTest('7. Successful login returns HTTP 200 and sets session cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email.toUpperCase(), // Test case-insensitive normalization
        password: testUser.password,
      });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.user?.email === testUser.email.toLowerCase(), 'Email matches normalized');
    const cookies = res.headers['set-cookie'];
    assert(Boolean(cookies && cookies.length > 0), 'Set-Cookie present');
    sessionCookie = cookies as unknown as string[];
  });

  // 8. Incorrect password rejected
  await runTest('8. Incorrect password returns HTTP 401 with generic message', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword123!',
      });

    assert(res.status === 401, `Expected 401, got ${res.status}`);
    assert(res.body.message === 'Invalid email or password', 'Must return generic message');
  });

  // 9. Login with nonexistent email rejected
  await runTest('9. Nonexistent email returns HTTP 401 with identical generic message', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: `nonexistent_${timestamp}@example.com`,
        password: 'SomePassword123!',
      });

    assert(res.status === 401, `Expected 401, got ${res.status}`);
    assert(res.body.message === 'Invalid email or password', 'Must return generic message');
  });

  // 10. Access to GET /api/v1/auth/me with cookie
  await runTest('10. Authenticated access to GET /api/v1/auth/me returns current user profile', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie);

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.user?.email === testUser.email.toLowerCase(), 'Returned user matches');
    assert(res.body.user?.name === testUser.name, 'Returned name matches');
    assert(res.body.user?.passwordHash === undefined, 'No passwordHash');
  });

  // 11. Access to /api/v1/auth/me without authentication
  await runTest('11. Unauthenticated access to GET /api/v1/auth/me returns HTTP 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    assert(res.status === 401, `Expected 401, got ${res.status}`);
    assert(res.body.status === 'error', 'Expected error status');
  });

  // 12. Invalid or forged JWT rejected
  await runTest('12. Forged JWT token signature is rejected with HTTP 401', async () => {
    const forgedToken = jwt.sign({ sub: 'forged-user-id', email: 'hacker@example.com' }, 'wrong-secret-key-1234567890123456');
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [`${env.COOKIE_NAME}=${forgedToken}`]);

    assert(res.status === 401, `Expected 401, got ${res.status}`);
    assert(res.body.message.includes('Invalid authentication token'), 'Expected invalid token message');
  });

  // 13. Expired JWT rejected
  await runTest('13. Expired JWT token is rejected with HTTP 401', async () => {
    const expiredToken = jwt.sign(
      { sub: 'test-user-id', email: testUser.email },
      env.JWT_SECRET,
      { expiresIn: '-1s' }
    );
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [`${env.COOKIE_NAME}=${expiredToken}`]);

    assert(res.status === 401, `Expected 401, got ${res.status}`);
    assert(res.body.message.includes('expired'), 'Expected expired token message');
  });

  // 14. Successful logout clears cookie
  await runTest('14. Successful logout (POST /api/v1/auth/logout) clears authentication cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', sessionCookie);

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const cookies = res.headers['set-cookie'];
    assert(Boolean(cookies && cookies.length > 0), 'Set-Cookie present on logout');
    const clearedCookie = (cookies as unknown as string[]).find((c) => c.startsWith(`${env.COOKIE_NAME}=`));
    assert(Boolean(clearedCookie), 'Cookie must be targeted in clearCookie');
    assert(clearedCookie!.includes('Expires=Thu, 01 Jan 1970') || clearedCookie!.includes('Max-Age=0'), 'Cookie expired on logout');
  });

  // 15. Access after logout rejected
  await runTest('15. Access to GET /api/v1/auth/me after logout returns HTTP 401', async () => {
    // Attempt request with the cleared cookie (or no cookie)
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [`${env.COOKIE_NAME}=`]);

    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });
  } finally {
    // Guaranteed isolated cleanup: clean up only the test user created during this run
    try {
      await prisma.user.deleteMany({
        where: { email: testUser.email.toLowerCase() },
      });
    } catch (cleanupErr) {
      console.error('Warning during auth test cleanup:', cleanupErr);
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
    console.error('\nTests failed! Review the errors above.');
    process.exit(1);
  } else {
    console.log('\nAll 15 authentication security tests passed successfully!');
  }
}

executeTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

