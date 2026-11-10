import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z
    .string({ required_error: 'Workspace name is required' })
    .trim()
    .min(2, 'Workspace name must be at least 2 characters')
    .max(64, 'Workspace name cannot exceed 64 characters'),
});

export const updateWorkspaceSchema = z.object({
  name: z
    .string({ required_error: 'Workspace name is required' })
    .trim()
    .min(2, 'Workspace name must be at least 2 characters')
    .max(64, 'Workspace name cannot exceed 64 characters'),
});

export const workspaceIdParamSchema = z.object({
  id: z.string().uuid('Invalid workspace ID format'),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

