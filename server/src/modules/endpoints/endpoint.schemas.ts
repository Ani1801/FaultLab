import { z } from 'zod';

export const normalizePath = (rawPath: string): string => {
  let p = rawPath.trim();
  if (!p.startsWith('/')) {
    p = '/' + p;
  }
  // Remove duplicate forward slashes
  p = p.replace(/\/+/g, '/');
  // Remove trailing slash unless path is root '/'
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }
  return p;
};

export const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], {
  errorMap: () => ({ message: 'Method must be one of: GET, POST, PUT, PATCH, DELETE' }),
});

export const failureModeSchema = z.enum(['NONE', 'ALWAYS', 'RANDOM'], {
  errorMap: () => ({ message: 'Failure mode must be one of: NONE, ALWAYS, RANDOM' }),
});

export const createEndpointSchema = z
  .object({
    name: z
      .string({ required_error: 'Endpoint name is required' })
      .trim()
      .min(2, 'Endpoint name must be at least 2 characters')
      .max(100, 'Endpoint name cannot exceed 100 characters'),
    method: httpMethodSchema,
    path: z
      .string({ required_error: 'Path is required' })
      .trim()
      .min(1, 'Path cannot be empty')
      .max(255, 'Path cannot exceed 255 characters')
      .refine(
        (val) => !/\s/.test(val),
        'Path must not contain whitespace'
      ),
    statusCode: z
      .number({ invalid_type_error: 'Status code must be a number' })
      .int('Status code must be an integer')
      .min(100, 'Status code must be at least 100')
      .max(599, 'Status code cannot exceed 599')
      .default(200)
      .optional(),
    responseBody: z.any().optional().default({}),
    responseHeaders: z
      .union([
        z.record(z.string()),
        z.null(),
      ])
      .optional(),
    responseDelay: z
      .number({ invalid_type_error: 'Response delay must be a number' })
      .int('Response delay must be an integer')
      .min(0, 'Response delay cannot be negative')
      .max(10000, 'Response delay cannot exceed 10000 ms (10 seconds)')
      .default(0)
      .optional(),
    // Phase 5 Fault Injection Fields
    faultEnabled: z
      .boolean({ invalid_type_error: 'faultEnabled must be a boolean' })
      .default(false)
      .optional(),
    failureMode: failureModeSchema.default('NONE').optional(),
    failureRate: z
      .number({ invalid_type_error: 'failureRate must be a number' })
      .int('failureRate must be an integer')
      .min(0, 'failureRate must be at least 0')
      .max(100, 'failureRate cannot exceed 100')
      .default(0)
      .optional(),
    failureStatusCode: z
      .number({ invalid_type_error: 'failureStatusCode must be a number' })
      .int('failureStatusCode must be an integer')
      .min(400, 'failureStatusCode must be at least 400')
      .max(599, 'failureStatusCode cannot exceed 599')
      .default(500)
      .optional(),
    failureResponseBody: z
      .any()
      .optional()
      .default({ error: 'Internal Server Error', message: 'Simulated fault injection' }),
    additionalDelay: z
      .number({ invalid_type_error: 'additionalDelay must be a number' })
      .int('additionalDelay must be an integer')
      .min(0, 'additionalDelay cannot be negative')
      .max(10000, 'additionalDelay cannot exceed 10000 ms (10 seconds)')
      .default(0)
      .optional(),
  })
  .strict('Unexpected fields in request body');

export const updateEndpointSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Endpoint name must be at least 2 characters')
      .max(100, 'Endpoint name cannot exceed 100 characters')
      .optional(),
    method: httpMethodSchema.optional(),
    path: z
      .string()
      .trim()
      .min(1, 'Path cannot be empty')
      .max(255, 'Path cannot exceed 255 characters')
      .refine((val) => !/\s/.test(val), 'Path must not contain whitespace')
      .optional(),
    statusCode: z
      .number({ invalid_type_error: 'Status code must be a number' })
      .int('Status code must be an integer')
      .min(100, 'Status code must be at least 100')
      .max(599, 'Status code cannot exceed 599')
      .optional(),
    responseBody: z.any().optional(),
    responseHeaders: z
      .union([
        z.record(z.string()),
        z.null(),
      ])
      .optional(),
    responseDelay: z
      .number({ invalid_type_error: 'Response delay must be a number' })
      .int('Response delay must be an integer')
      .min(0, 'Response delay cannot be negative')
      .max(10000, 'Response delay cannot exceed 10000 ms')
      .optional(),
    // Phase 5 Fault Injection Fields
    faultEnabled: z
      .boolean({ invalid_type_error: 'faultEnabled must be a boolean' })
      .optional(),
    failureMode: failureModeSchema.optional(),
    failureRate: z
      .number({ invalid_type_error: 'failureRate must be a number' })
      .int('failureRate must be an integer')
      .min(0, 'failureRate must be at least 0')
      .max(100, 'failureRate cannot exceed 100')
      .optional(),
    failureStatusCode: z
      .number({ invalid_type_error: 'failureStatusCode must be a number' })
      .int('failureStatusCode must be an integer')
      .min(400, 'failureStatusCode must be at least 400')
      .max(599, 'failureStatusCode cannot exceed 599')
      .optional(),
    failureResponseBody: z.any().optional(),
    additionalDelay: z
      .number({ invalid_type_error: 'additionalDelay must be a number' })
      .int('additionalDelay must be an integer')
      .min(0, 'additionalDelay cannot be negative')
      .max(10000, 'additionalDelay cannot exceed 10000 ms')
      .optional(),
  })
  .strict('Unexpected fields in request body')
  .refine(
    (data) => Object.keys(data).length > 0,
    'At least one field must be provided for update'
  );

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
});

export const endpointIdParamSchema = z.object({
  id: z.string().uuid('Invalid endpoint ID format'),
});
