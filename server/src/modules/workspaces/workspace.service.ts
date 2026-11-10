import { prisma } from '../../utils/prisma.js';
import type { WorkspaceResponse, CreateWorkspaceDTO, UpdateWorkspaceDTO } from './workspace.types.js';

export class WorkspaceService {
  /**
   * Creates a new workspace owned strictly by the authenticated user.
   * Owner ID is always derived server-side from the verified JWT.
   */
  async createWorkspace(userId: string, data: CreateWorkspaceDTO): Promise<WorkspaceResponse> {
    const workspace = await prisma.workspace.create({
      data: {
        name: data.name.trim(),
        ownerId: userId,
      },
    });

    return workspace;
  }

  /**
   * Lists all workspaces owned by the authenticated user.
   * Scoped strictly by ownerId to guarantee multi-tenant isolation.
   */
  async listWorkspaces(userId: string): Promise<WorkspaceResponse[]> {
    const workspaces = await prisma.workspace.findMany({
      where: {
        ownerId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return workspaces;
  }

  /**
   * Retrieves a specific workspace by ID, ensuring the authenticated user is the owner.
   * Returns 404 if the workspace does not exist OR belongs to another user (anti-IDOR).
   */
  async getWorkspace(userId: string, workspaceId: string): Promise<WorkspaceResponse> {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        ownerId: userId,
      },
    });

    if (!workspace) {
      const error = new Error('Workspace not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return workspace;
  }

  /**
   * Updates an existing workspace name.
   * Enforces ownership directly within the database mutation using updateMany.
   * Preserves 404 behavior for missing or foreign workspaces.
   */
  async updateWorkspace(
    userId: string,
    workspaceId: string,
    data: UpdateWorkspaceDTO
  ): Promise<WorkspaceResponse> {
    const trimmedName = data.name.trim();

    // Enforce ownership directly in the database update mutation
    const updateResult = await prisma.workspace.updateMany({
      where: {
        id: workspaceId,
        ownerId: userId,
      },
      data: {
        name: trimmedName,
      },
    });

    if (updateResult.count === 0) {
      const error = new Error('Workspace not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Retrieve the updated record using both id and ownerId
    const updated = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        ownerId: userId,
      },
    });

    if (!updated) {
      const error = new Error('Workspace not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return updated;
  }

  /**
   * Deletes a workspace owned by the authenticated user.
   * Enforces ownership directly within the database mutation using deleteMany.
   * Preserves 404 behavior for missing or foreign workspaces.
   */
  async deleteWorkspace(userId: string, workspaceId: string): Promise<void> {
    // Enforce ownership directly in the database delete mutation
    const deleteResult = await prisma.workspace.deleteMany({
      where: {
        id: workspaceId,
        ownerId: userId,
      },
    });

    if (deleteResult.count === 0) {
      const error = new Error('Workspace not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
  }
}

export const workspaceService = new WorkspaceService();
