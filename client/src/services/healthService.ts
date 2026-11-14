import { apiClient } from './apiClient';
import { ApiError } from '../types/api';
import type { HealthCheckResponse } from '../types/health';

export const healthService = {
  /**
   * Fetches health status from GET /api/v1/health.
   * If server is reachable but database is degraded (HTTP 503), the response body
   * still contains the diagnostic HealthCheckResponse object.
   */
  async getHealth(): Promise<HealthCheckResponse> {
    try {
      return await apiClient.get<HealthCheckResponse>('/health', { coldStartTolerance: true });
    } catch (error) {
      if (error instanceof ApiError && error.data && typeof error.data === 'object') {
        const errorData = error.data as Record<string, unknown>;
        if ('server' in errorData && 'database' in errorData) {
          return errorData as unknown as HealthCheckResponse;
        }
      }
      throw error;
    }
  },
};

