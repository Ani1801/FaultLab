export interface RequestLog {
  id: string;
  projectId: string;
  endpointId: string | null;
  endpoint?: {
    id: string;
    name: string;
    method: string;
    path: string;
  } | null;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  requestSize: number | null;
  responseSize: number | null;
  isFaultInjected: boolean;
  wasMatched: boolean;
  createdAt: string;
}

export interface ListRequestLogsParams {
  page?: number;
  limit?: number;
  method?: string;
  statusCode?: number;
  endpointId?: string;
  faultInjected?: boolean;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface PaginatedRequestLogsResponse {
  status: 'success';
  data: RequestLog[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface StatusBreakdownItem {
  statusCode: number;
  count: number;
}

export interface MethodBreakdownItem {
  method: string;
  count: number;
}

export interface VolumeOverTimeItem {
  timestamp: string;
  count: number;
  errors: number;
  faults: number;
}

export interface AnalyticsData {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  faultInjectedRequests: number;
  successRate: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  statusBreakdown: StatusBreakdownItem[];
  methodBreakdown: MethodBreakdownItem[];
  volumeOverTime: VolumeOverTimeItem[];
  timeRange: '24h' | '7d' | '30d';
}

export interface AnalyticsResponse {
  status: 'success';
  analytics: AnalyticsData;
}

