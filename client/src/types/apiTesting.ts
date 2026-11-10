export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type AuthType = 'NONE' | 'BEARER' | 'BASIC' | 'API_KEY';
export type TestRunStatus = 'PASSED' | 'FAILED' | 'ERROR';

export type AssertionOperator =
  | 'EXISTS'
  | 'NOT_EXISTS'
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'CONTAINS';

export interface KeyValuePair {
  key: string;
  value: string;
  enabled?: boolean;
}

export interface JsonAssertion {
  field: string;
  operator: AssertionOperator;
  value?: any;
}

export interface AssertionResultItem {
  name: string;
  type: string;
  expected: any;
  actual: any;
  passed: boolean;
  message?: string;
}

export interface AuthConfigInput {
  token?: string;
  username?: string;
  password?: string;
  key?: string;
  value?: string;
  addTo?: 'HEADER' | 'QUERY';
}

export interface ApiTest {
  id: string;
  projectId: string;
  name: string;
  method: HttpMethod;
  url: string;
  queryParams: KeyValuePair[];
  headers: KeyValuePair[];
  requestBody: string | null;
  authenticationType: AuthType;
  hasCredentials: boolean;
  timeoutMs: number;
  expectedStatusCode: number | null;
  expectedResponse: JsonAssertion[];
  maxResponseTime: number | null;
  lastRun?: {
    id: string;
    status: TestRunStatus;
    actualStatusCode: number | null;
    responseTime: number;
    executedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTestRun {
  id: string;
  projectId: string;
  apiTestId: string | null;
  status: TestRunStatus;
  actualStatusCode: number | null;
  responseTime: number;
  responseSize: number | null;
  responseHeaders: Record<string, string>;
  assertionResults: AssertionResultItem[];
  sanitizedResponseBody: string | null;
  errorMessage: string | null;
  executedAt: string;
}

export interface CreateApiTestInput {
  name: string;
  method: HttpMethod;
  url: string;
  queryParams?: KeyValuePair[];
  headers?: KeyValuePair[];
  requestBody?: string | null;
  authenticationType?: AuthType;
  authenticationConfig?: AuthConfigInput;
  timeoutMs?: number;
  expectedStatusCode?: number | null;
  expectedResponse?: JsonAssertion[];
  maxResponseTime?: number | null;
}

export interface UpdateApiTestInput {
  name?: string;
  method?: HttpMethod;
  url?: string;
  queryParams?: KeyValuePair[];
  headers?: KeyValuePair[];
  requestBody?: string | null;
  authenticationType?: AuthType;
  authenticationConfig?: AuthConfigInput;
  timeoutMs?: number;
  expectedStatusCode?: number | null;
  expectedResponse?: JsonAssertion[];
  maxResponseTime?: number | null;
}

export interface ExecuteUnsavedInput {
  method: HttpMethod;
  url: string;
  queryParams?: KeyValuePair[];
  headers?: KeyValuePair[];
  requestBody?: string | null;
  authenticationType?: AuthType;
  authenticationConfig?: AuthConfigInput;
  timeoutMs?: number;
  expectedStatusCode?: number | null;
  expectedResponse?: JsonAssertion[];
  maxResponseTime?: number | null;
  saveRun?: boolean;
}

