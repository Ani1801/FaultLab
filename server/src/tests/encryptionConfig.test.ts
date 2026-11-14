import assert from 'node:assert';
import crypto from 'node:crypto';
import {
  validateEncryptionKey,
  createEnvSchema,
  DEV_ENCRYPTION_KEY_FALLBACK,
} from '../config/env.js';
import { encryptCredentials, decryptCredentials } from '../modules/api-testing/crypto.utils.js';

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
  console.log('--- Starting FaultLab Encryption & Key Security Test Suite ---\n');

  // --- SECTION 1: Production Startup Key Validation ---

  await runTest('Production: Rejects missing API_TEST_ENCRYPTION_KEY', () => {
    const result = validateEncryptionKey(undefined, 'production');
    assert.strictEqual(result.isValid, false, 'Missing key in production must be invalid');
    assert.match(result.error || '', /mandatory in production mode/i);
  });

  await runTest('Production: Rejects empty or whitespace API_TEST_ENCRYPTION_KEY', () => {
    const result = validateEncryptionKey('   ', 'production');
    assert.strictEqual(result.isValid, false, 'Whitespace key in production must be invalid');
    assert.match(result.error || '', /mandatory in production mode/i);
  });

  await runTest('Production: Rejects default placeholder key from .env.example', () => {
    const placeholder = 'your_64_hex_character_encryption_key_at_least_32_bytes_long';
    const result = validateEncryptionKey(placeholder, 'production');
    assert.strictEqual(result.isValid, false, 'Placeholder key in production must be rejected');
    assert.match(result.error || '', /insecure placeholder/i);
  });

  await runTest('Production: Rejects development fallback key in production', () => {
    const result = validateEncryptionKey(DEV_ENCRYPTION_KEY_FALLBACK, 'production');
    assert.strictEqual(result.isValid, false, 'Development fallback key must be rejected in production');
    assert.match(result.error || '', /insecure placeholder or development key/i);
  });

  await runTest('Production: Rejects key with invalid length (63 hex chars)', () => {
    const shortHex = 'a'.repeat(63);
    const result = validateEncryptionKey(shortHex, 'production');
    assert.strictEqual(result.isValid, false, '63 hex chars must be rejected');
    assert.match(result.error || '', /exactly 64 hexadecimal characters/i);
  });

  await runTest('Production: Rejects key with invalid length (65 hex chars)', () => {
    const longHex = 'a'.repeat(65);
    const result = validateEncryptionKey(longHex, 'production');
    assert.strictEqual(result.isValid, false, '65 hex chars must be rejected');
    assert.match(result.error || '', /exactly 64 hexadecimal characters/i);
  });

  await runTest('Production: Rejects 64-char key containing non-hex characters', () => {
    // 63 valid hex chars + 1 non-hex char ('g')
    const nonHex = 'a'.repeat(63) + 'g';
    const result = validateEncryptionKey(nonHex, 'production');
    assert.strictEqual(result.isValid, false, 'Non-hex chars in key must be rejected');
    assert.match(result.error || '', /exactly 64 hexadecimal characters/i);
  });

  await runTest('Production: Accepts valid 64-char lowercase hexadecimal key', () => {
    const validKey = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const result = validateEncryptionKey(validKey, 'production');
    assert.strictEqual(result.isValid, true, 'Valid 64-hex key must be accepted');
    assert.strictEqual(result.resolvedKey, validKey);
    assert.strictEqual(result.error, undefined);
  });

  await runTest('Production: Accepts valid 64-char uppercase / mixed hexadecimal key', () => {
    const validMixed = 'E3B0C44298FC1C149AFBF4C8996FB92427ae41e4649b934ca495991b7852b855';
    const result = validateEncryptionKey(validMixed, 'production');
    assert.strictEqual(result.isValid, true, 'Mixed-case 64-hex key must be accepted');
    assert.strictEqual(result.resolvedKey, validMixed);
  });

  // --- SECTION 2: Local Development & Test Mode Configuration ---

  await runTest('Development: Automatically falls back to dev key when missing', () => {
    const result = validateEncryptionKey(undefined, 'development');
    assert.strictEqual(result.isValid, true, 'Missing key in development must succeed');
    assert.strictEqual(result.resolvedKey, DEV_ENCRYPTION_KEY_FALLBACK);
  });

  await runTest('Development: Accepts custom key of >= 32 characters', () => {
    const customKey = 'my_custom_local_dev_key_that_is_long_enough';
    const result = validateEncryptionKey(customKey, 'development');
    assert.strictEqual(result.isValid, true, 'Valid dev key must succeed');
    assert.strictEqual(result.resolvedKey, customKey);
  });

  await runTest('Development: Rejects key that is shorter than 32 characters', () => {
    const tooShort = 'short_key';
    const result = validateEncryptionKey(tooShort, 'development');
    assert.strictEqual(result.isValid, false, 'Dev key < 32 chars must be rejected');
    assert.match(result.error || '', /at least 32 characters/i);
  });

  // --- SECTION 3: Full Schema & Startup Parse Validation ---

  const baseValidEnv = {
    PORT: '5000',
    CORS_ORIGIN: 'http://localhost:5173',
    DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/faultlab',
    JWT_SECRET: 'a_very_secure_jwt_secret_key_at_least_32_characters_long',
    PUBLIC_API_BASE_URL: 'https://faultlab-backend.onrender.com',
  };

  await runTest('Schema: Fails production environment parse when encryption key is missing', () => {
    const prodSchema = createEnvSchema('production');
    const result = prodSchema.safeParse({
      ...baseValidEnv,
      NODE_ENV: 'production',
    });
    assert.strictEqual(result.success, false, 'Production parse must fail without key');
    const issues = result.error?.issues.filter((i) => i.path.includes('API_TEST_ENCRYPTION_KEY'));
    assert(issues && issues.length > 0, 'Must contain issue for API_TEST_ENCRYPTION_KEY');
  });

  await runTest('Schema: Fails production environment parse when encryption key is placeholder', () => {
    const prodSchema = createEnvSchema('production');
    const result = prodSchema.safeParse({
      ...baseValidEnv,
      NODE_ENV: 'production',
      API_TEST_ENCRYPTION_KEY: 'your_64_hex_character_encryption_key_at_least_32_bytes_long',
    });
    assert.strictEqual(result.success, false, 'Production parse must fail with placeholder key');
  });

  await runTest('Schema: Succeeds production environment parse with valid 64-hex key', () => {
    const prodSchema = createEnvSchema('production');
    const validHexKey = crypto.randomBytes(32).toString('hex');
    const result = prodSchema.safeParse({
      ...baseValidEnv,
      NODE_ENV: 'production',
      API_TEST_ENCRYPTION_KEY: validHexKey,
    });
    assert.strictEqual(result.success, true, 'Production parse must succeed with valid key');
    if (result.success) {
      assert.strictEqual(result.data.API_TEST_ENCRYPTION_KEY, validHexKey);
    }
  });

  await runTest('Schema: Succeeds development environment parse without key, providing fallback', () => {
    const devSchema = createEnvSchema('development');
    const result = devSchema.safeParse({
      ...baseValidEnv,
      NODE_ENV: 'development',
    });
    assert.strictEqual(result.success, true, 'Development parse must succeed without key');
    if (result.success) {
      assert.strictEqual(result.data.API_TEST_ENCRYPTION_KEY, DEV_ENCRYPTION_KEY_FALLBACK);
    }
  });

  // --- SECTION 4: Encryption and Decryption Behavior ---

  await runTest('Crypto: Encrypts and decrypts credential object accurately with AES-256-GCM', () => {
    const credentials = {
      type: 'BEARER',
      token: 'flab_test_token_super_secret_12345',
      headerName: 'Authorization',
    };

    const ciphertext = encryptCredentials(credentials);
    assert.strictEqual(typeof ciphertext, 'string');
    // Format: iv:auth_tag:ciphertext
    const parts = ciphertext.split(':');
    assert.strictEqual(parts.length, 3, 'Ciphertext must contain iv, auth tag, and payload');
    assert.strictEqual(parts[0]?.length, 32, 'IV must be 16 bytes (32 hex chars)');
    assert.strictEqual(parts[1]?.length, 32, 'Auth tag must be 16 bytes (32 hex chars)');

    const decrypted = decryptCredentials<typeof credentials>(ciphertext);
    assert.deepStrictEqual(decrypted, credentials, 'Decrypted credentials must match original input exactly');
  });

  await runTest('Crypto: Distinct encryptions generate different IVs and ciphertexts', () => {
    const data = { secret: 'identical_secret_value' };
    const enc1 = encryptCredentials(data);
    const enc2 = encryptCredentials(data);
    assert.notStrictEqual(enc1, enc2, 'Two encryptions of identical plaintext must yield distinct ciphertexts (random IV)');
    assert.deepStrictEqual(decryptCredentials(enc1), decryptCredentials(enc2));
  });

  await runTest('Crypto: Fails decryption gracefully on tampered ciphertext', () => {
    const credentials = { apiKey: 'my-production-api-key' };
    const validCiphertext = encryptCredentials(credentials);
    const parts = validCiphertext.split(':');

    // Tamper with the ciphertext part
    const tamperedCiphertext = `${parts[0]}:${parts[1]}:ff${parts[2]?.slice(2)}`;
    assert.throws(
      () => decryptCredentials(tamperedCiphertext),
      /Failed to decrypt authentication credentials/i,
      'Decryption of tampered ciphertext must throw an authentication tag verification error'
    );
  });

  await runTest('Crypto: Rejects malformed payload strings lacking iv:auth_tag:payload format', () => {
    assert.throws(
      () => decryptCredentials('not-valid-encrypted-format'),
      /Malformed encrypted credential payload|Failed to decrypt/i
    );
  });

  // --- SUMMARY ---
  console.log('\n========================================');
  console.log(`ENCRYPTION SECURITY TEST RESULTS:`);
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal error running encryption test suite:', err);
  process.exit(1);
});

