import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Explicitly resolve server/.env relative to this config file directory
// (works consistently whether executed from workspace root or server directory)
const serverEnvPath = path.resolve(__dirname, '../../.env');

// Prioritize server/.env with override: true so server configuration is always authoritative
dotenv.config({ path: serverEnvPath, override: true });
// Fallback: also load current working directory .env if serverEnvPath was not found
dotenv.config();

export const DEV_ENCRYPTION_KEY_FALLBACK =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export const INSECURE_KEY_PLACEHOLDERS = new Set([
  'your_64_hex_character_encryption_key_at_least_32_bytes_long',
  '0000000000000000000000000000000000000000000000000000000000000000',
  '1111111111111111111111111111111111111111111111111111111111111111',
  DEV_ENCRYPTION_KEY_FALLBACK,
]);

/**
 * Validates the API_TEST_ENCRYPTION_KEY based on deployment environment.
 * NEVER prints or logs the key value.
 */
export function validateEncryptionKey(
  key: string | undefined,
  nodeEnv: string = 'development'
): { isValid: boolean; error?: string; resolvedKey: string } {
  const isProduction = nodeEnv === 'production';

  if (isProduction) {
    if (!key || key.trim() === '') {
      return {
        isValid: false,
        error:
          'API_TEST_ENCRYPTION_KEY is mandatory in production mode. Set a valid 64-hexadecimal character key in your environment.',
        resolvedKey: '',
      };
    }

    const trimmed = key.trim();

    if (INSECURE_KEY_PLACEHOLDERS.has(trimmed.toLowerCase())) {
      return {
        isValid: false,
        error:
          'API_TEST_ENCRYPTION_KEY cannot use an insecure placeholder or development key in production.',
        resolvedKey: '',
      };
    }

    if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return {
        isValid: false,
        error:
          'API_TEST_ENCRYPTION_KEY in production must be exactly 64 hexadecimal characters (representing a 32-byte master key).',
        resolvedKey: '',
      };
    }

    return { isValid: true, resolvedKey: trimmed };
  }

  // Development / Test mode
  if (!key || key.trim() === '') {
    return { isValid: true, resolvedKey: DEV_ENCRYPTION_KEY_FALLBACK };
  }

  const trimmed = key.trim();
  if (trimmed.length < 32) {
    return {
      isValid: false,
      error: 'API_TEST_ENCRYPTION_KEY must be at least 32 characters long.',
      resolvedKey: '',
    };
  }

  return { isValid: true, resolvedKey: trimmed };
}

/**
 * Validates the PUBLIC_API_BASE_URL based on deployment environment.
 * In production, strictly requires a valid HTTPS backend URL.
 * In development, defaults to http://localhost:5000.
 */
export function validatePublicApiBaseUrl(
  url: string | undefined,
  nodeEnv: string = 'development'
): { isValid: boolean; error?: string; resolvedUrl: string } {
  const isProduction = nodeEnv === 'production';

  if (isProduction) {
    if (!url || url.trim() === '') {
      return {
        isValid: false,
        error:
          'PUBLIC_API_BASE_URL is mandatory in production mode. Set your public HTTPS backend URL (e.g. https://faultlab-backend.onrender.com).',
        resolvedUrl: '',
      };
    }

    const trimmed = url.trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return {
        isValid: false,
        error: `PUBLIC_API_BASE_URL must be a valid URL (received: ${trimmed}).`,
        resolvedUrl: '',
      };
    }

    if (parsed.protocol !== 'https:') {
      return {
        isValid: false,
        error: `PUBLIC_API_BASE_URL must use HTTPS in production mode (received: ${parsed.protocol}).`,
        resolvedUrl: '',
      };
    }

    // Normalize: strip trailing slashes and /api/v1 if included
    const normalized = trimmed.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
    return { isValid: true, resolvedUrl: normalized };
  }

  // Development / Test mode
  if (!url || url.trim() === '') {
    return { isValid: true, resolvedUrl: 'http://localhost:5000' };
  }

  const trimmed = url.trim();
  try {
    new URL(trimmed);
  } catch {
    return {
      isValid: false,
      error: `PUBLIC_API_BASE_URL must be a valid URL (received: ${trimmed}).`,
      resolvedUrl: '',
    };
  }

  const normalized = trimmed.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  return { isValid: true, resolvedUrl: normalized };
}

export const createEnvSchema = (nodeEnv: string = process.env.NODE_ENV || 'development') => {
  return z
    .object({
      PORT: z
        .string()
        .default('5000')
        .transform((val) => {
          const parsed = parseInt(val, 10);
          if (isNaN(parsed)) {
            throw new Error('PORT must be a valid integer');
          }
          return parsed;
        }),
      NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
      CORS_ORIGIN: z.string().default('http://localhost:5173'),
      DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
      DIRECT_URL: z.string().optional(),
      JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
      JWT_EXPIRES_IN: z.string().default('24h'),
      COOKIE_NAME: z.string().default('faultlab_auth'),
      API_TEST_ENCRYPTION_KEY: z.string().optional(),
      PUBLIC_API_BASE_URL: z.string().optional(),
      ALLOW_LOCAL_NETWORK_API_TESTING: z
        .string()
        .default('false')
        .transform((val) => val === 'true'),
    })
    .superRefine((data, ctx) => {
      const currentEnv = data.NODE_ENV || nodeEnv;
      const keyValidation = validateEncryptionKey(data.API_TEST_ENCRYPTION_KEY, currentEnv);

      if (!keyValidation.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['API_TEST_ENCRYPTION_KEY'],
          message: keyValidation.error,
        });
      }

      const urlValidation = validatePublicApiBaseUrl(data.PUBLIC_API_BASE_URL, currentEnv);
      if (!urlValidation.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PUBLIC_API_BASE_URL'],
          message: urlValidation.error,
        });
      }
    })
    .transform((data) => {
      const keyValidation = validateEncryptionKey(data.API_TEST_ENCRYPTION_KEY, data.NODE_ENV);
      const urlValidation = validatePublicApiBaseUrl(data.PUBLIC_API_BASE_URL, data.NODE_ENV);
      return {
        ...data,
        API_TEST_ENCRYPTION_KEY: keyValidation.resolvedKey,
        PUBLIC_API_BASE_URL: urlValidation.resolvedUrl,
      };
    });
};

export const parseEnv = (rawEnv: NodeJS.ProcessEnv = process.env) => {
  const schema = createEnvSchema(rawEnv.NODE_ENV);
  const result = schema.safeParse(rawEnv);

  if (!result.success) {
    if (rawEnv.NODE_ENV !== 'test') {
      console.error('Invalid environment variables:');
      console.error(result.error.format());
      process.exit(1);
    }
    throw new Error(`Environment validation failed: ${JSON.stringify(result.error.format())}`);
  }

  return result.data;
};

export const env = parseEnv();
export type EnvConfig = ReturnType<typeof parseEnv>;

