import type { HttpMethod, FailureMode } from '@prisma/client';

export type { HttpMethod, FailureMode };

export interface MockEndpointResponse {
  id: string;
  projectId: string;
  name: string;
  method: HttpMethod;
  path: string;
  statusCode: number;
  responseBody: unknown;
  responseHeaders: Record<string, string> | null;
  responseDelay: number;
  faultEnabled: boolean;
  failureMode: FailureMode;
  failureRate: number;
  failureStatusCode: number;
  failureResponseBody: unknown;
  additionalDelay: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEndpointDTO {
  name: string;
  method: HttpMethod;
  path: string;
  statusCode?: number;
  responseBody?: unknown;
  responseHeaders?: Record<string, string> | null;
  responseDelay?: number;
  faultEnabled?: boolean;
  failureMode?: FailureMode;
  failureRate?: number;
  failureStatusCode?: number;
  failureResponseBody?: unknown;
  additionalDelay?: number;
}

export interface UpdateEndpointDTO {
  name?: string;
  method?: HttpMethod;
  path?: string;
  statusCode?: number;
  responseBody?: unknown;
  responseHeaders?: Record<string, string> | null;
  responseDelay?: number;
  faultEnabled?: boolean;
  failureMode?: FailureMode;
  failureRate?: number;
  failureStatusCode?: number;
  failureResponseBody?: unknown;
  additionalDelay?: number;
}
