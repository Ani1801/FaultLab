import { prisma } from '../../utils/prisma.js';
import type {
  ProjectResponse,
  CreateProjectDTO,
  UpdateProjectDTO,
} from './project.types.js';

export class ProjectService {
  /**
   * Creates a new project inside a workspace.
   * Verifies that the parent workspace exists and is owned by the authenticated user.
   */
  async createProject(
    userId: string,
    workspaceId: string,
    data: CreateProjectDTO
  ): Promise<ProjectResponse> {
    // 1. Verify parent workspace exists and belongs to the authenticated user
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

    // 2. Normalize description: null or empty string converts to null
    const normalizedDescription =
      data.description !== undefined && data.description !== null
        ? data.description.trim() || null
        : null;

    // 3. Persist project
    const project = await prisma.project.create({
      data: {
        name: data.name.trim(),
        description: normalizedDescription,
        workspaceId,
      },
    });

    return project;
  }

  /**
   * Lists all projects in a workspace.
   * Verifies that the parent workspace belongs to the authenticated user.
   */
  async listProjects(userId: string, workspaceId: string): Promise<ProjectResponse[]> {
    // 1. Verify parent workspace ownership
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

    // 2. Retrieve projects ordered by newest first
    const projects = await prisma.project.findMany({
      where: {
        workspaceId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return projects;
  }

  /**
   * Retrieves a specific project by ID.
   * Verifies ownership through its parent workspace in a single relational query.
   * Returns 404 if not found or unauthorized (anti-IDOR).
   */
  async getProject(userId: string, projectId: string): Promise<ProjectResponse> {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          ownerId: userId,
        },
      },
    });

    if (!project) {
      const error = new Error('Project not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return project;
  }

  /**
   * Updates an existing project's name and/or description.
   * Atomically enforces ownership through the parent workspace in the mutation.
   */
  async updateProject(
    userId: string,
    projectId: string,
    data: UpdateProjectDTO
  ): Promise<ProjectResponse> {
    const updateData: { name?: string; description?: string | null } = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }

    if (data.description !== undefined) {
      updateData.description =
        data.description !== null ? data.description.trim() || null : null;
    }

    // Atomically enforce ownership via relation filter in updateMany
    const updateResult = await prisma.project.updateMany({
      where: {
        id: projectId,
        workspace: {
          ownerId: userId,
        },
      },
      data: updateData,
    });

    if (updateResult.count === 0) {
      const error = new Error('Project not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Retrieve the updated record scoped to owner
    const updated = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          ownerId: userId,
        },
      },
    });

    if (!updated) {
      const error = new Error('Project not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return updated;
  }

  /**
   * Deletes a project.
   * Atomically enforces ownership through the parent workspace in the mutation.
   */
  async deleteProject(userId: string, projectId: string): Promise<void> {
    // Atomically enforce ownership via relation filter in deleteMany
    const deleteResult = await prisma.project.deleteMany({
      where: {
        id: projectId,
        workspace: {
          ownerId: userId,
        },
      },
    });

    if (deleteResult.count === 0) {
      const error = new Error('Project not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
  }
}

export const projectService = new ProjectService();

