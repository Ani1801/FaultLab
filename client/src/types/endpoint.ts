export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type FailureMode = 'NONE' | 'ALWAYS' | 'RANDOM';

export interface MockEndpoint {
  id: string;
  projectId: string;
  name: string;
  method: HttpMethod;
  path: string;
  statusCode: number;
  responseBody: any;
  responseHeaders: Record<string, string> | null;
  responseDelay: number;
  faultEnabled: boolean;
  failureMode: FailureMode;
  failureRate: number;
  failureStatusCode: number;
  failureResponseBody: any;
  additionalDelay: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEndpointDTO {
  name: string;
  method: HttpMethod;
  path: string;
  statusCode?: number;
  responseBody?: any;
  responseHeaders?: Record<string, string> | null;
  responseDelay?: number;
  faultEnabled?: boolean;
  failureMode?: FailureMode;
  failureRate?: number;
  failureStatusCode?: number;
  failureResponseBody?: any;
  additionalDelay?: number;
}

export interface UpdateEndpointDTO {
  name?: string;
  method?: HttpMethod;
  path?: string;
  statusCode?: number;
  responseBody?: any;
  responseHeaders?: Record<string, string> | null;
  responseDelay?: number;
  faultEnabled?: boolean;
  failureMode?: FailureMode;
  failureRate?: number;
  failureStatusCode?: number;
  failureResponseBody?: any;
  additionalDelay?: number;
}

export interface EndpointSuccessResponse {
  status: 'success';
  message?: string;
  endpoint: MockEndpoint;
}

export interface EndpointListResponse {
  status: 'success';
  endpoints: MockEndpoint[];
  count: number;
}
