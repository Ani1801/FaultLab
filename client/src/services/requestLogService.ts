import { apiClient } from './apiClient';
import type {
  PaginatedRequestLogsResponse,
  RequestLog,
  AnalyticsResponse,
  ListRequestLogsParams,
} from '../types/requestLog';

export class RequestLogService {
  /**
   * Fetches paginated request history logs for a project with optional filters.
   */
  async listRequests(
    projectId: string,
    params: ListRequestLogsParams = {}
  ): Promise<PaginatedRequestLogsResponse> {
    const searchParams = new URLSearchParams();

    if (params.page !== undefined) searchParams.set('page', String(params.page));
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params.method) searchParams.set('method', params.method);
    if (params.statusCode !== undefined) searchParams.set('statusCode', String(params.statusCode));
    if (params.endpointId) searchParams.set('endpointId', params.endpointId);
    if (params.faultInjected !== undefined) searchParams.set('faultInjected', String(params.faultInjected));
    if (params.startDate) searchParams.set('startDate', params.startDate);
    if (params.endDate) searchParams.set('endDate', params.endDate);
    if (params.search) searchParams.set('search', params.search);

    const queryString = searchParams.toString();
    const endpoint = `/projects/${projectId}/requests${queryString ? `?${queryString}` : ''}`;

    return apiClient.get<PaginatedRequestLogsResponse>(endpoint);
  }

  /**
   * Fetches details of a specific request log.
   */
  async getRequest(projectId: string, requestId: string): Promise<{ status: 'success'; data: RequestLog }> {
    return apiClient.get<{ status: 'success'; data: RequestLog }>(
      `/projects/${projectId}/requests/${requestId}`
    );
  }

  /**
   * Fetches aggregated analytics and performance statistics.
   */
  async getAnalytics(
    projectId: string,
    timeRange: '24h' | '7d' | '30d' = '24h'
  ): Promise<AnalyticsResponse> {
    return apiClient.get<AnalyticsResponse>(
      `/projects/${projectId}/analytics?timeRange=${timeRange}`
    );
  }
}

export const requestLogService = new RequestLogService();

