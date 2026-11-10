import { apiClient } from './apiClient';
import type {
  Project,
  CreateProjectDTO,
  UpdateProjectDTO,
  ProjectListResponse,
  ProjectSuccessResponse,
} from '../types/project';

export const projectService = {
  /**
   * Lists all projects within a specified workspace.
   */
  async listProjects(workspaceId: string): Promise<Project[]> {
    const response = await apiClient.get<ProjectListResponse>(
      `/workspaces/${workspaceId}/projects`
    );
    return response.projects;
  },

  /**
   * Retrieves single project details by ID.
   */
  async getProject(id: string): Promise<Project> {
    const response = await apiClient.get<ProjectSuccessResponse>(`/projects/${id}`);
    return response.project;
  },

  /**
   * Creates a new project in the specified workspace.
   */
  async createProject(
    workspaceId: string,
    data: CreateProjectDTO
  ): Promise<Project> {
    const response = await apiClient.post<ProjectSuccessResponse>(
      `/workspaces/${workspaceId}/projects`,
      data
    );
    return response.project;
  },

  /**
   * Updates an existing project's name and/or description.
   */
  async updateProject(
    id: string,
    data: UpdateProjectDTO
  ): Promise<Project> {
    const response = await apiClient.patch<ProjectSuccessResponse>(
      `/projects/${id}`,
      data
    );
    return response.project;
  },

  /**
   * Deletes a project by ID.
   */
  async deleteProject(id: string): Promise<void> {
    await apiClient.delete<{ status: string; message: string }>(`/projects/${id}`);
  },
};

