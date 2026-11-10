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

const envSchema = z.object({
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
  API_TEST_ENCRYPTION_KEY: z
    .string()
    .min(32, 'API_TEST_ENCRYPTION_KEY must be at least 32 characters long')
    .default('your_64_hex_character_encryption_key_at_least_32_bytes_long'),
  ALLOW_LOCAL_NETWORK_API_TESTING: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();
export type EnvConfig = z.infer<typeof envSchema>;
