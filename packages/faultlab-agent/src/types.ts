export interface AgentStoredConfig {
  agentId: string;
  token: string;
  approvedOrigin: string;
  serverUrl: string;
  agentName: string;
  projectId: string;
  pairedAt: string;
}

export interface AgentTaskPayload {
  url: string;
  method: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: unknown;
  bodyType?: string;
  timeoutMs?: number;
  testConfig?: {
    id?: string;
    name?: string;
    assertions?: Array<{
      id?: string;
      field: string;
      operator: string;
      expectedValue: string;
    }>;
  };
}

export interface AgentTask {
  id: string;
  type: string;
  payload: AgentTaskPayload;
  expiresAt: string;
}

export interface AgentExecutionEvidence {
  targetUrl: string;
  resolvedIp?: string;
  localOrigin: string;
  tlsVersion?: string;
  redirectCount: number;
}

export interface AgentExecutionResult {
  statusCode: number;
  statusText: string;
  responseTime: number;
  responseSize: number;
  responseHeaders: Record<string, string>;
  rawBody: string;
  parsedBody?: unknown;
  isExecutionError: boolean;
  errorMessage?: string;
  errorCode?: string;
  evidence: AgentExecutionEvidence;
}

export interface PairingResponse {
  agentId: string;
  token: string;
  name: string;
  approvedOrigin: string;
  projectId: string;
}

export interface HeartbeatResponse {
  status: string;
  pendingTasks: number;
}

