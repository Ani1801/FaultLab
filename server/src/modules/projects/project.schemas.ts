import { z } from 'zod';

export const createProjectSchema = z
  .object({
    name: z
      .string({ required_error: 'Project name is required' })
      .trim()
      .min(2, 'Project name must be at least 2 characters')
      .max(64, 'Project name cannot exceed 64 characters'),
    description: z
      .union([
        z.string().trim().max(500, 'Description cannot exceed 500 characters'),
        z.null(),
      ])
      .optional(),
  })
  .strict('Unexpected fields in request body');

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Project name must be at least 2 characters')
      .max(64, 'Project name cannot exceed 64 characters')
      .optional(),
    description: z
      .union([
        z.string().trim().max(500, 'Description cannot exceed 500 characters'),
        z.null(),
      ])
      .optional(),
  })
  .strict('Unexpected fields in request body')
  .refine(
    (data) => data.name !== undefined || data.description !== undefined,
    'At least one field (name or description) must be provided for update'
  );

export const workspaceIdParamSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID format'),
});

export const projectIdParamSchema = z.object({
  id: z.string().uuid('Invalid project ID format'),
});

