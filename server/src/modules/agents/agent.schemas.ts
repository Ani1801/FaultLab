// FaultLab - Phase 9: Local Diagnostic Agent Zod Schemas

import { z } from 'zod';

// Origin validator: Must be valid HTTP or HTTPS origin without trailing path (or stripped)
const approvedOriginSchema = z
  .string()
  .trim()
  .min(7, 'Origin must be at least 7 characters (e.g. http://localhost:5000)')
  .refine((val) => {
    try {
      const parsed = new URL(val);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Approved origin must be a valid HTTP or HTTPS URL (e.g. http://localhost:5000)')
  .transform((val) => {
    const parsed = new URL(val);
    return `${parsed.protocol}//${parsed.host}`;
  });

export const requestPairingSchema = z.object({
  approvedOrigin: approvedOriginSchema,
  agentName: z.string().trim().max(100).optional(),
});

export const agentPairExchangeSchema = z.object({
  pairingCode: z.string().trim().min(6).max(64, 'Invalid pairing code'),
  deviceName: z.string().trim().min(1).max(100).default('Local Machine'),
  systemInfo: z.record(z.any()).optional(),
});

export const agentHeartbeatSchema = z.object({
  systemInfo: z.record(z.any()).optional(),
});

const keyValuePairSchema = z.object({
  key: z.string(),
  value: z.string(),
  enabled: z.boolean().optional(),
});

const jsonAssertionConfigSchema = z.object({
  field: z.string().min(1, 'Assertion field path is required'),
  operator: z.enum([
    'EXISTS',
    'NOT_EXISTS',
    'EQUALS',
    'NOT_EQUALS',
    'GREATER_THAN',
    'LESS_THAN',
    'CONTAINS',
  ]),
  value: z.any().optional(),
});

export const createAgentTaskPayloadSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  url: z.string().trim().min(1, 'URL is required'),
  queryParams: z.array(keyValuePairSchema).optional(),
  headers: z.array(keyValuePairSchema).optional(),
  requestBody: z.string().nullable().optional(),
  timeoutMs: z.number().int().min(100).max(30000).optional(),
  expectedStatusCode: z.number().int().min(100).max(599).nullable().optional(),
  expectedResponse: z.array(jsonAssertionConfigSchema).optional(),
  maxResponseTime: z.number().int().positive().nullable().optional(),
});

export const enqueueAgentTaskSchema = z.preprocess((val: any) => {
  if (val && typeof val === 'object' && !val.payload && (val.url || val.method)) {
    const { agentId, saveRun, apiTestId, ...rest } = val;
    return {
      agentId,
      saveRun,
      apiTestId,
      payload: {
        method: rest.method,
        url: rest.url,
        queryParams: Array.isArray(rest.queryParams)
          ? rest.queryParams
          : rest.queryParams && typeof rest.queryParams === 'object'
          ? Object.entries(rest.queryParams).map(([key, value]) => ({ key, value: String(value) }))
          : undefined,
        headers: Array.isArray(rest.headers)
          ? rest.headers
          : rest.headers && typeof rest.headers === 'object'
          ? Object.entries(rest.headers).map(([key, value]) => ({ key, value: String(value) }))
          : undefined,
        requestBody: rest.requestBody || (rest.body ? (typeof rest.body === 'string' ? rest.body : JSON.stringify(rest.body)) : undefined),
        timeoutMs: rest.timeoutMs,
        expectedStatusCode: rest.expectedStatusCode,
        expectedResponse: rest.expectedResponse || (rest.testConfig?.assertions ? rest.testConfig.assertions.map((a: any) => ({
          field: a.field,
          operator: a.operator,
          value: a.expectedValue ?? a.value,
        })) : undefined),
        maxResponseTime: rest.maxResponseTime,
      },
    };
  }
  return val;
}, z.object({
  agentId: z.string().uuid('Invalid agent ID'),
  payload: createAgentTaskPayloadSchema,
  saveRun: z.boolean().optional(),
  apiTestId: z.string().uuid('Invalid API Test ID').nullable().optional(),
}));

export const submitTaskResultSchema = z.preprocess((val: any) => {
  if (val && typeof val === 'object' && val.result) {
    return val.result;
  }
  return val;
}, z.object({
  statusCode: z.number().int().nullable(),
  responseTime: z.number().int().nonnegative(),
  responseSize: z.number().int().nonnegative().nullable(),
  responseHeaders: z.record(z.string()).default({}),
  rawBody: z.string().default(''),
  isExecutionError: z.boolean(),
  errorMessage: z.string().nullable().optional(),
}));

export const agentIdParamSchema = z.object({
  agentId: z.string().uuid('Invalid agent ID'),
});

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
});

export const taskIdParamSchema = z.object({
  taskId: z.string().uuid('Invalid task ID'),
});
