import { apiClient } from './apiClient';
import type {
  Workspace,
  WorkspaceListResponse,
  WorkspaceSuccessResponse,
} from '../types/workspace';

export const workspaceService = {
  /**
   * Fetches all workspaces owned by the authenticated user.
   */
  async listWorkspaces(): Promise<Workspace[]> {
    const response = await apiClient.get<WorkspaceListResponse>('/workspaces');
    return response.workspaces;
  },

  /**
   * Retrieves single workspace details by ID.
   */
  async getWorkspace(id: string): Promise<Workspace> {
    const response = await apiClient.get<WorkspaceSuccessResponse>(`/workspaces/${id}`);
    return response.workspace;
  },

  /**
   * Creates a new workspace.
   */
  async createWorkspace(name: string): Promise<Workspace> {
    const response = await apiClient.post<WorkspaceSuccessResponse>('/workspaces', { name });
    return response.workspace;
  },

  /**
   * Updates/renames an existing workspace.
   */
  async updateWorkspace(id: string, name: string): Promise<Workspace> {
    const response = await apiClient.patch<WorkspaceSuccessResponse>(`/workspaces/${id}`, { name });
    return response.workspace;
  },

  /**
   * Renames workspace via PATCH request (alias for updateWorkspace).
   */
  async renameWorkspace(id: string, name: string): Promise<Workspace> {
    return this.updateWorkspace(id, name);
  },

  /**
   * Deletes a workspace by ID.
   */
  async deleteWorkspace(id: string): Promise<void> {
    await apiClient.delete<{ status: string; message: string }>(`/workspaces/${id}`);
  },
};
