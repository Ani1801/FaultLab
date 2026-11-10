export interface RequestLogResponse {
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
  createdAt: Date;
}

export interface ListRequestLogsQuery {
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
  data: RequestLogResponse[];
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

export interface AnalyticsResponse {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  faultInjectedRequests: number;
  successRate: number; // e.g. 95.5
  avgResponseTime: number; // in ms
  minResponseTime: number; // in ms
  maxResponseTime: number; // in ms
  statusBreakdown: StatusBreakdownItem[];
  methodBreakdown: MethodBreakdownItem[];
  volumeOverTime: VolumeOverTimeItem[];
  timeRange: string;
}

export interface RecordRequestLogDTO {
  projectId: string;
  endpointId?: string | null;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  requestSize?: number | null;
  responseSize?: number | null;
  isFaultInjected?: boolean;
  wasMatched?: boolean;
}

