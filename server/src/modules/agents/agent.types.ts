// FaultLab - Phase 9: Local Diagnostic Agent Types

import type { KeyValuePair } from '../api-testing/http.executor.js';
import type { JsonAssertionConfig } from '../api-testing/assertion.engine.js';
import type { DiagnosticReport } from '../diagnostics/diagnostic.types.js';
import type { ApiTestRunResponse } from '../api-testing/apiTest.types.js';

export type AgentStatusType = 'ONLINE' | 'OFFLINE' | 'REVOKED';
export type AgentTaskStatusType = 'PENDING' | 'PICKED_UP' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

// ─── Pairing DTOs ─────────────────────────────────────────────────────────────

export interface RequestPairingDTO {
  approvedOrigin: string;
  agentName?: string;
}

export interface PairingSessionResponse {
  pairingCode: string;
  approvedOrigin: string;
  expiresAt: string;
  instructions: string;
  connectCommand?: string;
}

export interface AgentPairExchangeDTO {
  pairingCode: string;
  deviceName: string;
  systemInfo?: Record<string, any>;
}

export interface AgentPairExchangeResponse {
  agentId: string;
  agentToken: string;
  token?: string;
  name?: string;
  approvedOrigin: string;
  projectId: string;
  projectName: string;
}

// ─── Agent Info ───────────────────────────────────────────────────────────────

export interface LocalAgentResponse {
  id: string;
  projectId: string;
  name: string;
  approvedOrigin: string;
  status: AgentStatusType;
  lastSeenAt: string | null;
  systemInfo: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Task DTOs ────────────────────────────────────────────────────────────────

export interface CreateAgentTaskPayload {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  queryParams?: KeyValuePair[];
  headers?: KeyValuePair[];
  requestBody?: string | null;
  timeoutMs?: number;
  expectedStatusCode?: number | null;
  expectedResponse?: JsonAssertionConfig[];
  maxResponseTime?: number | null;
}

export interface EnqueueAgentTaskDTO {
  agentId: string;
  payload: CreateAgentTaskPayload;
  saveRun?: boolean;
  apiTestId?: string | null;
}

export interface AgentTaskResponse {
  id: string;
  agentId: string;
  projectId: string;
  type: string;
  status: AgentTaskStatusType;
  payload: CreateAgentTaskPayload;
  result?: AgentTaskExecutionResult | null;
  apiTestRunId?: string | null;
  testRun?: ApiTestRunResponse | null;
  apiTestRun?: ApiTestRunResponse | null;
  diagnosticReport?: (DiagnosticReport & { healthScore?: number }) | null;
  expiresAt: string;
  completedAt?: string | null;
  createdAt: string;
}

// ─── Execution Result Reported by Agent ───────────────────────────────────────

export interface AgentTaskExecutionResult {
  statusCode: number | null;
  responseTime: number;
  responseSize: number | null;
  responseHeaders: Record<string, string>;
  rawBody: string;
  isExecutionError: boolean;
  errorMessage?: string | null;
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

export interface AgentHeartbeatDTO {
  systemInfo?: Record<string, any>;
}

export interface AgentHeartbeatResponse {
  status: 'ok';
  approvedOrigin: string;
  pendingTasksCount: number;
}
