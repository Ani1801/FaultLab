import { prisma } from '../../utils/prisma.js';
import type {
  MockEndpointResponse,
  CreateEndpointDTO,
  UpdateEndpointDTO,
} from './endpoint.types.js';
import { normalizePath } from './endpoint.schemas.js';

export class EndpointService {
  /**
   * Creates a new mock endpoint in a project.
   * Verifies that the parent project exists and is owned by the authenticated user.
   */
  async createEndpoint(
    userId: string,
    projectId: string,
    data: CreateEndpointDTO
  ): Promise<MockEndpointResponse> {
    // 1. Verify parent project exists and belongs to the authenticated user via workspace
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

    // 2. Normalize path
    const normalizedPath = normalizePath(data.path);

    // 3. Check for duplicate method + path in this project
    const existing = await prisma.mockEndpoint.findUnique({
      where: {
        projectId_method_path: {
          projectId,
          method: data.method,
          path: normalizedPath,
        },
      },
    });

    if (existing) {
      const error = new Error(
        `An endpoint with method ${data.method} and path "${normalizedPath}" already exists in this project`
      ) as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    // 4. Create mock endpoint record with Phase 4 & Phase 5 fault injection fields
    const endpoint = await prisma.mockEndpoint.create({
      data: {
        projectId,
        name: data.name.trim(),
        method: data.method,
        path: normalizedPath,
        statusCode: data.statusCode ?? 200,
        responseBody: (data.responseBody !== undefined ? data.responseBody : {}) as any,
        responseHeaders: (data.responseHeaders !== undefined ? data.responseHeaders : null) as any,
        responseDelay: data.responseDelay ?? 0,
        faultEnabled: data.faultEnabled ?? false,
        failureMode: data.failureMode ?? 'NONE',
        failureRate: data.failureRate ?? 0,
        failureStatusCode: data.failureStatusCode ?? 500,
        failureResponseBody: (data.failureResponseBody !== undefined
          ? data.failureResponseBody
          : { error: 'Internal Server Error', message: 'Simulated fault injection' }) as any,
        additionalDelay: data.additionalDelay ?? 0,
      },
    });

    return endpoint as unknown as MockEndpointResponse;
  }

  /**
   * Lists all mock endpoints in a project.
   * Verifies that the parent project belongs to the authenticated user.
   */
  async listEndpoints(userId: string, projectId: string): Promise<MockEndpointResponse[]> {
    // 1. Verify parent project ownership
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

    // 2. Retrieve endpoints ordered by path and method
    const endpoints = await prisma.mockEndpoint.findMany({
      where: {
        projectId,
      },
      orderBy: [
        { path: 'asc' },
        { method: 'asc' },
      ],
    });

    return endpoints as unknown as MockEndpointResponse[];
  }

  /**
   * Retrieves a specific mock endpoint by ID.
   * Verifies ownership through project and workspace in a single relational query.
   * Returns 404 if not found or unauthorized (anti-IDOR).
   */
  async getEndpoint(userId: string, endpointId: string): Promise<MockEndpointResponse> {
    const endpoint = await prisma.mockEndpoint.findFirst({
      where: {
        id: endpointId,
        project: {
          workspace: {
            ownerId: userId,
          },
        },
      },
    });

    if (!endpoint) {
      const error = new Error('Endpoint not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return endpoint as unknown as MockEndpointResponse;
  }

  /**
   * Updates an existing mock endpoint.
   * Enforces ownership and unique constraint checks.
   */
  async updateEndpoint(
    userId: string,
    endpointId: string,
    data: UpdateEndpointDTO
  ): Promise<MockEndpointResponse> {
    // 1. Find existing endpoint and verify ownership
    const existing = await prisma.mockEndpoint.findFirst({
      where: {
        id: endpointId,
        project: {
          workspace: {
            ownerId: userId,
          },
        },
      },
    });

    if (!existing) {
      const error = new Error('Endpoint not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // 2. Prepare update payload
    const updateData: Record<string, any> = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }

    const targetMethod = data.method ?? existing.method;
    const targetPath = data.path !== undefined ? normalizePath(data.path) : existing.path;

    if (data.method !== undefined) {
      updateData.method = data.method;
    }

    if (data.path !== undefined) {
      updateData.path = targetPath;
    }

    if (data.statusCode !== undefined) {
      updateData.statusCode = data.statusCode;
    }

    if (data.responseBody !== undefined) {
      updateData.responseBody = data.responseBody;
    }

    if (data.responseHeaders !== undefined) {
      updateData.responseHeaders = data.responseHeaders;
    }

    if (data.responseDelay !== undefined) {
      updateData.responseDelay = data.responseDelay;
    }

    // Phase 5 Fault Injection Fields
    if (data.faultEnabled !== undefined) {
      updateData.faultEnabled = data.faultEnabled;
    }

    if (data.failureMode !== undefined) {
      updateData.failureMode = data.failureMode;
    }

    if (data.failureRate !== undefined) {
      updateData.failureRate = data.failureRate;
    }

    if (data.failureStatusCode !== undefined) {
      updateData.failureStatusCode = data.failureStatusCode;
    }

    if (data.failureResponseBody !== undefined) {
      updateData.failureResponseBody = data.failureResponseBody;
    }

    if (data.additionalDelay !== undefined) {
      updateData.additionalDelay = data.additionalDelay;
    }

    // 3. If method or path changed, check for collision
    if (targetMethod !== existing.method || targetPath !== existing.path) {
      const collision = await prisma.mockEndpoint.findFirst({
        where: {
          projectId: existing.projectId,
          method: targetMethod,
          path: targetPath,
          id: { not: endpointId },
        },
      });

      if (collision) {
        const error = new Error(
          `An endpoint with method ${targetMethod} and path "${targetPath}" already exists in this project`
        ) as Error & { statusCode: number };
        error.statusCode = 409;
        throw error;
      }
    }

    // 4. Update endpoint
    const updated = await prisma.mockEndpoint.update({
      where: { id: endpointId },
      data: updateData,
    });

    return updated as unknown as MockEndpointResponse;
  }

  /**
   * Deletes a mock endpoint.
   * Verifies ownership before deleting.
   */
  async deleteEndpoint(userId: string, endpointId: string): Promise<void> {
    const existing = await prisma.mockEndpoint.findFirst({
      where: {
        id: endpointId,
        project: {
          workspace: {
            ownerId: userId,
          },
        },
      },
    });

    if (!existing) {
      const error = new Error('Endpoint not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    await prisma.mockEndpoint.delete({
      where: { id: endpointId },
    });
  }
}

export const endpointService = new EndpointService();
