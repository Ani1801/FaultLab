import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { getAuthCookieOptions, getClearCookieOptions } from '../modules/auth/auth.controller.js';

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[FAIL] ${name}: ${msg}`);
    failed++;
  }
}

async function runSuite(): Promise<void> {
  console.log('--- Starting FaultLab Vercel Proxy & Production Auth Configuration Test Suite ---\n');

  // --- SECTION 1: Vercel Proxy Rewrite Configuration ---

  const vercelJsonPath = path.resolve(__dirname, '../../../client/vercel.json');

  await runTest('Vercel Config: client/vercel.json exists and is valid JSON', () => {
    assert(fs.existsSync(vercelJsonPath), 'client/vercel.json must exist');
    const content = fs.readFileSync(vercelJsonPath, 'utf8');
    const parsed = JSON.parse(content);
    assert(typeof parsed === 'object', 'vercel.json must be a JSON object');
    assert(Array.isArray(parsed.rewrites), 'vercel.json must contain a rewrites array');
  });

  await runTest('Vercel Config: Rewrites contain correct proxy rules in proper evaluation order', () => {
    const content = fs.readFileSync(vercelJsonPath, 'utf8');
    const config = JSON.parse(content);
    const rewrites: Array<{ source: string; destination: string }> = config.rewrites;

    assert.strictEqual(rewrites.length, 3, 'Must have exactly 3 rewrite rules');

    // Rule 1: API proxy rule must be first
    assert.strictEqual(rewrites[0]?.source, '/api/v1/:path*', 'Rule 1 source must be /api/v1/:path*');
    assert(rewrites[0]?.destination.endsWith('/api/v1/:path*'), 'Rule 1 destination must route to /api/v1/:path* on Render backend');

    // Rule 2: Mock runtime proxy rule must be second
    assert.strictEqual(rewrites[1]?.source, '/mock/:path*', 'Rule 2 source must be /mock/:path*');
    assert(rewrites[1]?.destination.endsWith('/mock/:path*'), 'Rule 2 destination must route to /mock/:path* on Render backend');

    // Rule 3: SPA fallback must be last
    assert.strictEqual(rewrites[2]?.source, '/(.*)', 'Rule 3 source must be /(.*) for SPA fallback');
    assert.strictEqual(rewrites[2]?.destination, '/index.html', 'Rule 3 destination must be /index.html');
  });

  // --- SECTION 2: Cookie Configuration & Matching Options ---

  await runTest('Cookie Config: Auth cookie options enforce HttpOnly, SameSite=Lax, and Path=/', () => {
    const authOpts = getAuthCookieOptions();
    assert.strictEqual(authOpts.httpOnly, true, 'Auth cookie must be HttpOnly');
    assert.strictEqual(authOpts.sameSite, 'lax', 'Auth cookie must use SameSite=Lax for same-origin proxy');
    assert.strictEqual(authOpts.path, '/', 'Auth cookie path must be /');
    assert.strictEqual(typeof authOpts.maxAge, 'number', 'Auth cookie must define maxAge');
    assert(authOpts.maxAge! > 0, 'maxAge must be positive');
  });

  await runTest('Cookie Config: Clear cookie options exactly match creation security attributes', () => {
    const authOpts = getAuthCookieOptions();
    const clearOpts = getClearCookieOptions();

    assert.strictEqual(clearOpts.httpOnly, authOpts.httpOnly, 'httpOnly must match between set and clear');
    assert.strictEqual(clearOpts.secure, authOpts.secure, 'secure flag must match between set and clear');
    assert.strictEqual(clearOpts.sameSite, authOpts.sameSite, 'sameSite must match between set and clear');
    assert.strictEqual(clearOpts.path, authOpts.path, 'path must match between set and clear');
  });

  // --- SECTION 3: Frontend API URL & Mock URL Logic ---

  await runTest('Frontend Logic: Simulates production relative API base URL', () => {
    // Test helper mirroring client/src/services/apiClient.ts getApiBaseUrl
    const resolveBaseUrl = (envVar: string | undefined, isProd: boolean): string => {
      if (envVar) return envVar.replace(/\/+$/, '');
      if (isProd) return '/api/v1';
      return 'http://localhost:5000/api/v1';
    };

    // 1. Production without env var -> relative same-origin path
    assert.strictEqual(resolveBaseUrl(undefined, true), '/api/v1', 'Production without env var must return relative /api/v1');

    // 2. Local development without env var -> localhost:5000
    assert.strictEqual(resolveBaseUrl(undefined, false), 'http://localhost:5000/api/v1', 'Development must return localhost:5000/api/v1');

    // 3. Explicit env var -> honors value and strips trailing slash
    assert.strictEqual(resolveBaseUrl('https://custom.backend.com/api/v1/', true), 'https://custom.backend.com/api/v1');
  });

  await runTest('Frontend Logic: Simulates production vs development Mock URL generation', () => {
    const projectId = 'proj-123';

    const resolveMockUrl = (isProd: boolean, origin: string, host: string, proto: string): string => {
      if (isProd) {
        return `${origin}/mock/${projectId}`;
      }
      return `${proto}//${host}:5000/mock/${projectId}`;
    };

    // Production on Vercel -> same-origin /mock/proj-123
    const prodUrl = resolveMockUrl(true, 'https://faultlab.vercel.app', 'faultlab.vercel.app', 'https:');
    assert.strictEqual(prodUrl, 'https://faultlab.vercel.app/mock/proj-123');

    // Local dev on Vite -> localhost:5000/mock/proj-123
    const devUrl = resolveMockUrl(false, 'http://localhost:5173', 'localhost', 'http:');
    assert.strictEqual(devUrl, 'http://localhost:5000/mock/proj-123');
  });

  // --- SUMMARY ---
  console.log('\n========================================');
  console.log('VERCEL PROXY & AUTH TEST RESULTS:');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal error running proxy config test suite:', err);
  process.exit(1);
});

