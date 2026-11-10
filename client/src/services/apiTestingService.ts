import { apiClient } from './apiClient';
import type {
  ApiTest,
  ApiTestRun,
  CreateApiTestInput,
  UpdateApiTestInput,
  ExecuteUnsavedInput,
} from '../types/apiTesting';

export class ApiTestingService {
  /**
   * Creates a new saved API test.
   */
  async createApiTest(projectId: string, data: CreateApiTestInput): Promise<ApiTest> {
    const res = await apiClient.post<{ status: string; test: ApiTest }>(
      `/projects/${projectId}/api-tests`,
      data
    );
    return res.test;
  }

  /**
   * Lists all saved API tests for a project.
   */
  async listApiTests(projectId: string): Promise<ApiTest[]> {
    const res = await apiClient.get<{ status: string; tests: ApiTest[] }>(
      `/projects/${projectId}/api-tests`
    );
    return res.tests;
  }

  /**
   * Retrieves a single saved API test.
   */
  async getApiTest(id: string): Promise<ApiTest> {
    const res = await apiClient.get<{ status: string; test: ApiTest }>(
      `/api-tests/${id}`
    );
    return res.test;
  }

  /**
   * Updates an existing saved API test.
   */
  async updateApiTest(id: string, data: UpdateApiTestInput): Promise<ApiTest> {
    const res = await apiClient.patch<{ status: string; test: ApiTest }>(
      `/api-tests/${id}`,
      data
    );
    return res.test;
  }

  /**
   * Deletes a saved API test.
   */
  async deleteApiTest(id: string): Promise<void> {
    await apiClient.delete<{ status: string }>(`/api-tests/${id}`);
  }

  /**
   * Executes a saved API test.
   */
  async runApiTest(id: string): Promise<{ test: ApiTest; run: ApiTestRun }> {
    return apiClient.post<{ status: string; test: ApiTest; run: ApiTestRun }>(
      `/api-tests/${id}/run`,
      {}
    );
  }

  /**
   * Executes an unsaved ad-hoc API test.
   */
  async executeUnsavedTest(projectId: string, data: ExecuteUnsavedInput): Promise<ApiTestRun> {
    const res = await apiClient.post<{ status: string; run: ApiTestRun }>(
      `/projects/${projectId}/api-tests/execute`,
      data
    );
    return res.run;
  }

  /**
   * Retrieves paginated test execution history for a test.
   */
  async listTestRuns(
    id: string,
    page = 1,
    limit = 20
  ): Promise<{ runs: ApiTestRun[]; pagination: any }> {
    return apiClient.get<{ status: string; runs: ApiTestRun[]; pagination: any }>(
      `/api-tests/${id}/runs?page=${page}&limit=${limit}`
    );
  }

  /**
   * Retrieves a single test run result.
   */
  async getTestRun(runId: string): Promise<ApiTestRun> {
    const res = await apiClient.get<{ status: string; run: ApiTestRun }>(
      `/api-test-runs/${runId}`
    );
    return res.run;
  }
}

export const apiTestingService = new ApiTestingService();

