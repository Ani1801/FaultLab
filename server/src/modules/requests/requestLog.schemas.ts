import { z } from 'zod';

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
});

export const requestDetailParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
  requestId: z.string().uuid('Invalid request log ID format'),
});

export const listRequestLogsQuerySchema = z.object({
  page: z
    .preprocess((val) => (val !== undefined ? parseInt(String(val), 10) : 1), z.number().int().min(1))
    .default(1),
  limit: z
    .preprocess(
      (val) => (val !== undefined ? parseInt(String(val), 10) : 20),
      z.number().int().min(1).max(100)
    )
    .default(20),
  method: z
    .string()
    .trim()
    .toUpperCase()
    .optional(),
  statusCode: z
    .preprocess((val) => (val !== undefined ? parseInt(String(val), 10) : undefined), z.number().int().min(100).max(599))
    .optional(),
  endpointId: z.string().uuid('Invalid endpoint ID format').optional(),
  faultInjected: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean())
    .optional(),
  startDate: z
    .string()
    .datetime({ message: 'startDate must be a valid ISO datetime string' })
    .optional(),
  endDate: z
    .string()
    .datetime({ message: 'endDate must be a valid ISO datetime string' })
    .optional(),
  search: z.string().trim().max(100).optional(),
});

export const analyticsQuerySchema = z.object({
  timeRange: z
    .enum(['24h', '7d', '30d'], {
      errorMap: () => ({ message: 'timeRange must be one of: 24h, 7d, 30d' }),
    })
    .default('24h')
    .optional(),
});

