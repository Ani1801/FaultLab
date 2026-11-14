import { AgentStoredConfig } from './types';
import { AgentApiClient } from './client';
import { executeLocalTask } from './executor';

export interface PollerOptions {
  basePollIntervalMs?: number;
  maxPollIntervalMs?: number;
  heartbeatIntervalMs?: number;
  onStatusChange?: (status: string) => void;
  onTaskProcessed?: (taskId: string, statusCode: number, elapsed: number) => void;
  onRevoked?: () => void;
}

export class AgentPoller {
  private config: AgentStoredConfig;
  private client: AgentApiClient;
  private isRunning = false;
  private pollTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private currentIntervalMs: number;
  private baseIntervalMs: number;
  private maxIntervalMs: number;
  private heartbeatIntervalMs: number;
  private onRevoked?: () => void;

  constructor(config: AgentStoredConfig, options?: PollerOptions) {
    this.config = config;
    this.client = new AgentApiClient(config.serverUrl, config.token);
    // Bounded polling intervals: 2s active minimum, 20s idle maximum
    this.baseIntervalMs = options?.basePollIntervalMs || 2000;
    this.maxIntervalMs = options?.maxPollIntervalMs || 20000;
    this.heartbeatIntervalMs = options?.heartbeatIntervalMs || 30000;
    this.currentIntervalMs = this.baseIntervalMs;
    this.onRevoked = options?.onRevoked;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`[FaultLab Agent] Starting poller for agent "${this.config.agentName}"...`);
    console.log(`[FaultLab Agent] Approved local origin: ${this.config.approvedOrigin}`);
    console.log(`[FaultLab Agent] Connected to: ${this.config.serverUrl}`);
    console.log(`[FaultLab Agent] Polling interval: ${this.baseIntervalMs}ms active, backing off up to ${this.maxIntervalMs}ms when idle`);

    // Send immediate initial heartbeat
    try {
      await this.client.heartbeat();
      console.log(`[FaultLab Agent] Heartbeat acknowledged by server (ONLINE).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('AGENT_REVOKED_OR_UNAUTHORIZED')) {
        console.error(`[FaultLab Agent] ERROR: This agent token is invalid or has been revoked.`);
        this.stop();
        if (this.onRevoked) this.onRevoked();
        return;
      }
      console.warn(`[FaultLab Agent] Initial heartbeat warning: ${msg}`);
    }

    // Schedule regular heartbeats
    this.heartbeatTimer = setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.client.heartbeat();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('AGENT_REVOKED_OR_UNAUTHORIZED')) {
          console.error(`[FaultLab Agent] Agent token was revoked. Stopping poller.`);
          this.stop();
          if (this.onRevoked) this.onRevoked();
        }
      }
    }, this.heartbeatIntervalMs);

    // Start poll loop
    this.scheduleNextPoll(100);
  }

  private scheduleNextPoll(delayMs: number): void {
    if (!this.isRunning) return;
    this.pollTimer = setTimeout(async () => {
      await this.pollOnce();
    }, delayMs);
  }

  private async pollOnce(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const task = await this.client.pollTask();

      if (task) {
        // Reset backoff on task arrival
        this.currentIntervalMs = this.baseIntervalMs;
        console.log(`[FaultLab Agent] Task received [${task.id}]: ${task.payload.method} ${task.payload.url}`);

        // Execute task strictly against approved origin
        const result = await executeLocalTask(task.payload, this.config.approvedOrigin);
        console.log(
          `[FaultLab Agent] Task executed [${task.id}]: status=${result.statusCode} (${result.statusText}) in ${result.responseTime}ms`
        );

        // Submit execution result to backend
        try {
          await this.client.submitResult(task.id, result);
          console.log(`[FaultLab Agent] Task result submitted [${task.id}] successfully.`);
        } catch (submitErr) {
          console.error(`[FaultLab Agent] Failed to submit result for task [${task.id}]:`, submitErr);
        }

        // Immediately poll for any other pending tasks without delay
        this.scheduleNextPoll(100);
        return;
      } else {
        // Idle: apply exponential backoff (e.g. 2000ms -> 3000ms -> 4500ms -> 6750ms -> up to max)
        this.currentIntervalMs = Math.min(Math.round(this.currentIntervalMs * 1.5), this.maxIntervalMs);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('AGENT_REVOKED_OR_UNAUTHORIZED')) {
        console.error(`[FaultLab Agent] Agent has been revoked by the project owner. Exiting.`);
        this.stop();
        if (this.onRevoked) this.onRevoked();
        return;
      }
      // Connection failure to server, log clean warning (no sensitive token) and back off
      console.warn(`[FaultLab Agent] Temporary connection failure: ${msg}. Backing off to ${Math.round(this.maxIntervalMs / 1000)}s...`);
      this.currentIntervalMs = this.maxIntervalMs;
    }

    this.scheduleNextPoll(this.currentIntervalMs);
  }

  getCurrentIntervalMs(): number {
    return this.currentIntervalMs;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    console.log(`[FaultLab Agent] Poller stopped.`);
  }

  async shutdown(): Promise<void> {
    this.stop();
    try {
      await this.client.disconnect();
      console.log(`[FaultLab Agent] Disconnected from server.`);
    } catch {
      // Best effort
    }
  }
}

