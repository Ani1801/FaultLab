import crypto from 'node:crypto';
import { env } from '../../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128-bit initialization vector

/**
 * Derives a consistent 32-byte encryption key from the environment secret using SHA-256.
 */
function getDerivedKey(): Buffer {
  return crypto.createHash('sha256').update(env.API_TEST_ENCRYPTION_KEY).digest();
}

/**
 * Encrypts an authentication configuration object using AES-256-GCM.
 * The output format is `iv_hex:auth_tag_hex:ciphertext_hex`.
 */
export function encryptCredentials(data: Record<string, any>): string {
  try {
    const key = getDerivedKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const plaintext = JSON.stringify(data);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (error) {
    throw new Error('Failed to encrypt authentication credentials securely');
  }
}

/**
 * Decrypts an AES-256-GCM encrypted credentials string.
 * Returns the parsed credential configuration object.
 */
export function decryptCredentials<T = Record<string, any>>(encryptedStr: string): T {
  try {
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) {
      throw new Error('Malformed encrypted credential payload');
    }

    const [ivHex, authTagHex, ciphertextHex] = parts;
    const key = getDerivedKey();
    const iv = Buffer.from(ivHex!, 'hex');
    const authTag = Buffer.from(authTagHex!, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex!, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted) as T;
  } catch (error) {
    throw new Error('Failed to decrypt authentication credentials');
  }
}

