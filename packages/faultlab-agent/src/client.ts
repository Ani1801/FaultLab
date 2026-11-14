import os from 'os';
import {
  PairingResponse,
  HeartbeatResponse,
  AgentTask,
  AgentExecutionResult,
} from './types';

export function getSystemInfo(): Record<string, unknown> {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    nodeVersion: process.version,
    agentVersion: '1.0.0',
  };
}

export class AgentApiClient {
  private serverUrl: string;
  private token?: string;

  constructor(serverUrl: string, token?: string) {
    let parsed: URL;
    try {
      parsed = new URL(serverUrl);
    } catch {
      throw new Error(`Invalid server URL: "${serverUrl}". Must be a valid HTTP or HTTPS URL.`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported protocol "${parsed.protocol}". Server URL must use http: or https:.`);
    }

    // Normalize: strip trailing slashes and /api/v1 if included
    this.serverUrl = serverUrl.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
    this.token = token;
  }

  setToken(token: string): void {
    this.token = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'FaultLab-Agent/1.0.0',
    };
    if (this.token) {
      headers['X-FaultLab-Agent-Token'] = this.token;
    }
    return headers;
  }

  async pair(pairingCode: string, systemInfo?: Record<string, unknown>): Promise<PairingResponse> {
    const url = `${this.serverUrl}/api/v1/agent/pair`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairingCode,
        systemInfo: systemInfo || getSystemInfo(),
      }),
    });

    const data = (await res.json()) as any;
    const isSuccess = res.ok && (data.status === 'success' || data.success === true);
    if (!isSuccess) {
      throw new Error(data.message || data.error?.message || `Pairing failed with HTTP ${res.status}`);
    }

    const payload = data.data || data;
    return {
      agentId: payload.agentId,
      token: payload.token,
      name: payload.name,
      approvedOrigin: payload.approvedOrigin,
      projectId: payload.projectId,
    };
  }

  async heartbeat(systemInfo?: Record<string, unknown>): Promise<HeartbeatResponse> {
    const url = `${this.serverUrl}/api/v1/agent/heartbeat`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        systemInfo: systemInfo || getSystemInfo(),
      }),
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('AGENT_REVOKED_OR_UNAUTHORIZED');
    }

    const data = (await res.json()) as any;
    const isSuccess = res.ok && (data.status === 'success' || data.success === true);
    if (!isSuccess) {
      throw new Error(data.message || data.error?.message || `Heartbeat failed with HTTP ${res.status}`);
    }

    return {
      status: data.agentStatus || data.status || 'ONLINE',
      pendingTasks: typeof data.pendingTasks === 'number' ? data.pendingTasks : 0,
    };
  }

  async pollTask(): Promise<AgentTask | null> {
    const url = `${this.serverUrl}/api/v1/agent/tasks`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('AGENT_REVOKED_OR_UNAUTHORIZED');
    }

    if (!res.ok) {
      throw new Error(`Polling failed with HTTP ${res.status}`);
    }

    const data = (await res.json()) as any;
    return data.task || data.data?.task || null;
  }

  async submitResult(taskId: string, result: AgentExecutionResult): Promise<{ apiTestRunId?: string; diagnosticReportId?: string }> {
    const url = `${this.serverUrl}/api/v1/agent/tasks/${taskId}/result`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ result }),
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('AGENT_REVOKED_OR_UNAUTHORIZED');
    }

    const data = (await res.json()) as any;
    const isSuccess = res.ok && (data.status === 'success' || data.success === true);
    if (!isSuccess) {
      throw new Error(data.message || data.error?.message || `Result submission failed with HTTP ${res.status}`);
    }

    return {
      apiTestRunId: data.apiTestRunId || data.data?.apiTestRunId,
      diagnosticReportId: data.diagnosticReportId || data.data?.diagnosticReportId,
    };
  }

  async disconnect(): Promise<void> {
    const url = `${this.serverUrl}/api/v1/agent/disconnect`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
      });
    } catch {
      // Best effort on disconnect
    }
  }
}
