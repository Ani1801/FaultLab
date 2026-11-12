import { z } from 'zod';

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
});

export const testIdParamSchema = z.object({
  id: z.string().uuid('Invalid API test ID format'),
});

export const testRunIdParamSchema = z.object({
  runId: z.string().uuid('Invalid API test run ID format'),
});

export const keyValuePairSchema = z.object({
  key: z.string().trim(),
  value: z.string(),
  enabled: z.boolean().default(true).optional(),
});

export const jsonAssertionSchema = z.object({
  field: z.string().min(1, 'Assertion field path is required').max(100),
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

export const authConfigInputSchema = z.object({
  token: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  key: z.string().optional(),
  value: z.string().optional(),
  addTo: z.enum(['HEADER', 'QUERY']).default('HEADER').optional(),
});

export const createApiTestSchema = z.object({
  name: z.string().trim().min(1, 'Test name is required').max(100, 'Test name cannot exceed 100 characters'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  url: z.string().trim().min(1, 'Target API URL is required'),
  queryParams: z.array(keyValuePairSchema).optional().default([]),
  headers: z.array(keyValuePairSchema).optional().default([]),
  requestBody: z.union([z.string(), z.record(z.any())]).nullable().optional(),
  authenticationType: z.enum(['NONE', 'BEARER', 'BASIC', 'API_KEY']).default('NONE'),
  authenticationConfig: authConfigInputSchema.optional(),
  timeoutMs: z.number().int().min(100, 'Minimum timeout is 100ms').max(30000, 'Maximum timeout is 30,000ms').default(5000),
  expectedStatusCode: z.number().int().min(100).max(599).nullable().optional(),
  expectedResponse: z.array(jsonAssertionSchema).optional().default([]),
  maxResponseTime: z.number().int().min(1).max(60000).nullable().optional(),
});

export const updateApiTestSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  url: z.string().trim().min(1).optional(),
  queryParams: z.array(keyValuePairSchema).optional(),
  headers: z.array(keyValuePairSchema).optional(),
  requestBody: z.union([z.string(), z.record(z.any())]).nullable().optional(),
  authenticationType: z.enum(['NONE', 'BEARER', 'BASIC', 'API_KEY']).optional(),
  authenticationConfig: authConfigInputSchema.optional(),
  timeoutMs: z.number().int().min(100).max(30000).optional(),
  expectedStatusCode: z.number().int().min(100).max(599).nullable().optional(),
  expectedResponse: z.array(jsonAssertionSchema).optional(),
  maxResponseTime: z.number().int().min(1).max(60000).nullable().optional(),
});

export const executeUnsavedTestSchema = z.object({
  apiTestId: z.string().uuid().nullable().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  url: z.string().trim().min(1, 'Target API URL is required'),
  queryParams: z.array(keyValuePairSchema).optional().default([]),
  headers: z.array(keyValuePairSchema).optional().default([]),
  requestBody: z.union([z.string(), z.record(z.any())]).nullable().optional(),
  authenticationType: z.enum(['NONE', 'BEARER', 'BASIC', 'API_KEY']).default('NONE'),
  authenticationConfig: authConfigInputSchema.optional(),
  timeoutMs: z.number().int().min(100).max(30000).default(5000),
  expectedStatusCode: z.number().int().min(100).max(599).nullable().optional(),
  expectedResponse: z.array(jsonAssertionSchema).optional().default([]),
  maxResponseTime: z.number().int().min(1).max(60000).nullable().optional(),
  saveRun: z.boolean().default(false).optional(),
});

export const listTestRunsQuerySchema = z.object({
  page: z
    .preprocess((val) => (val !== undefined ? parseInt(String(val), 10) : 1), z.number().int().min(1))
    .default(1),
  limit: z
    .preprocess((val) => (val !== undefined ? parseInt(String(val), 10) : 20), z.number().int().min(1).max(100))
    .default(20),
});

