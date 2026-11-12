import { ApiTestRun } from './apiTesting';
import { DiagnosticFinding } from './diagnostic';

export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'REVOKED';
export type AgentTaskStatus = 'PENDING' | 'PICKED_UP' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface LocalAgent {
  id: string;
  projectId: string;
  name: string;
  approvedOrigin: string;
  status: AgentStatus;
  lastSeenAt: string | null;
  systemInfo?: {
    hostname?: string;
    platform?: string;
    release?: string;
    arch?: string;
    nodeVersion?: string;
    agentVersion?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PairingSessionResponse {
  sessionId?: string;
  pairingCode: string;
  expiresAt: string;
  approvedOrigin: string;
  connectCommand: string;
  instructions?: string;
}

export interface AgentTaskExecutionResult {
  statusCode: number;
  statusText: string;
  responseTime: number;
  responseSize: number;
  responseHeaders: Record<string, string>;
  rawBody: string;
  parsedBody?: any;
  isExecutionError: boolean;
  errorMessage?: string;
  errorCode?: string;
  evidence?: {
    targetUrl: string;
    resolvedIp?: string;
    localOrigin: string;
    tlsVersion?: string;
    redirectCount: number;
  };
}

export interface AgentTask {
  id: string;
  agentId: string;
  projectId: string;
  type: string;
  status: AgentTaskStatus;
  payload: any;
  result?: AgentTaskExecutionResult | null;
  apiTestRunId?: string | null;
  apiTestRun?: ApiTestRun | null;
  diagnosticReport?: {
    id: string;
    summary: string;
    healthScore: number;
    findings: DiagnosticFinding[];
    rulesEvaluated: number;
    createdAt: string;
  } | null;
  expiresAt: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

