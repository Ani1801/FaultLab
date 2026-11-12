import { apiClient } from './apiClient';
import type {
  LocalAgent,
  PairingSessionResponse,
  AgentTask,
} from '../types/agent';

export interface RequestPairingInput {
  approvedOrigin: string;
  agentName?: string;
}

export interface EnqueueTaskInput {
  agentId?: string;
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
      expectedValue?: any;
      value?: any;
    }>;
  };
}

export class AgentService {
  /**
   * Request a new pairing session for the project.
   */
  async requestPairing(
    projectId: string,
    data: RequestPairingInput
  ): Promise<PairingSessionResponse> {
    const res = await apiClient.post<{
      status: string;
      message?: string;
      session?: PairingSessionResponse;
      data?: PairingSessionResponse | { session?: PairingSessionResponse };
    }>(`/projects/${projectId}/agents/pair`, data);

    const session =
      res.session ||
      (res.data && 'session' in res.data ? res.data.session : (res.data as PairingSessionResponse)) ||
      (res as unknown as PairingSessionResponse);

    if (!session || !session.pairingCode) {
      throw new Error('Invalid pairing session response received from server');
    }

    return session;
  }

  /**
   * List all registered local agents for a project.
   */
  async listAgents(projectId: string): Promise<LocalAgent[]> {
    const res = await apiClient.get<{
      status: string;
      agents?: LocalAgent[];
      data?: { agents?: LocalAgent[] } | LocalAgent[];
    }>(`/projects/${projectId}/agents`);

    if (Array.isArray(res.agents)) return res.agents;
    if (res.data) {
      if (Array.isArray(res.data)) return res.data;
      if (Array.isArray(res.data.agents)) return res.data.agents;
    }
    return [];
  }

  /**
   * Revoke an agent.
   */
  async revokeAgent(projectId: string, agentId: string): Promise<LocalAgent> {
    const res = await apiClient.delete<{
      status: string;
      agent?: LocalAgent;
      data?: { agent?: LocalAgent } | LocalAgent;
    }>(`/projects/${projectId}/agents/${agentId}`);

    return (
      res.agent ||
      (res.data && 'agent' in res.data ? res.data.agent : (res.data as LocalAgent)) ||
      (res as unknown as LocalAgent)
    );
  }

  /**
   * Enqueue a test execution task for an agent.
   */
  async enqueueExecution(
    projectId: string,
    data: EnqueueTaskInput
  ): Promise<AgentTask> {
    const res = await apiClient.post<{
      status: string;
      task?: AgentTask;
      data?: { task?: AgentTask } | AgentTask;
    }>(`/projects/${projectId}/agents/execute`, data);

    return (
      res.task ||
      (res.data && 'task' in res.data ? res.data.task : (res.data as AgentTask)) ||
      (res as unknown as AgentTask)
    );
  }

  /**
   * Get task status, result, and associated diagnostic report.
   */
  async getTask(projectId: string, taskId: string): Promise<AgentTask> {
    const res = await apiClient.get<{
      status: string;
      task?: AgentTask;
      data?: { task?: AgentTask } | AgentTask;
    }>(`/projects/${projectId}/agents/tasks/${taskId}`);

    return (
      res.task ||
      (res.data && 'task' in res.data ? res.data.task : (res.data as AgentTask)) ||
      (res as unknown as AgentTask)
    );
  }
}

export const agentService = new AgentService();
