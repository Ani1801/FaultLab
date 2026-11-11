// FaultLab - Phase 8: Diagnostic Zod Schemas

import { z } from 'zod';

export const runIdParamSchema = z.object({
  runId: z.string().uuid('Invalid run ID'),
});

export const projectIdParamSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
});

export const listDiagnosticsQuerySchema = z.object({
  overallStatus: z
    .enum(['HEALTHY', 'WARNING', 'CRITICAL_ISSUES'])
    .optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1).max(10000)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

