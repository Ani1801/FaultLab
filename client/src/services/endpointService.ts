import { apiClient } from './apiClient';
import type {
  MockEndpoint,
  CreateEndpointDTO,
  UpdateEndpointDTO,
  EndpointListResponse,
  EndpointSuccessResponse,
} from '../types/endpoint';

export const endpointService = {
  /**
   * Lists all mock endpoints configured for a project.
   */
  async listEndpoints(projectId: string): Promise<MockEndpoint[]> {
    const response = await apiClient.get<EndpointListResponse>(
      `/projects/${projectId}/endpoints`
    );
    return response.endpoints;
  },

  /**
   * Retrieves single endpoint details by ID.
   */
  async getEndpoint(id: string): Promise<MockEndpoint> {
    const response = await apiClient.get<EndpointSuccessResponse>(`/endpoints/${id}`);
    return response.endpoint;
  },

  /**
   * Creates a new mock endpoint in a project.
   */
  async createEndpoint(
    projectId: string,
    data: CreateEndpointDTO
  ): Promise<MockEndpoint> {
    const response = await apiClient.post<EndpointSuccessResponse>(
      `/projects/${projectId}/endpoints`,
      data
    );
    return response.endpoint;
  },

  /**
   * Updates an existing mock endpoint.
   */
  async updateEndpoint(
    id: string,
    data: UpdateEndpointDTO
  ): Promise<MockEndpoint> {
    const response = await apiClient.patch<EndpointSuccessResponse>(
      `/endpoints/${id}`,
      data
    );
    return response.endpoint;
  },

  /**
   * Deletes a mock endpoint by ID.
   */
  async deleteEndpoint(id: string): Promise<void> {
    await apiClient.delete<{ status: string; message: string }>(`/endpoints/${id}`);
  },
};

