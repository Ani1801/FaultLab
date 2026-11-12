import { AgentStoredConfig } from './types';
import { AgentApiClient } from './client';
import { executeLocalTask } from './executor';

export interface PollerOptions {
  basePollIntervalMs?: number;
  maxPollIntervalMs?: number;
  heartbeatIntervalMs?: number;
  onStatusChange?: (status: string) => void;
  onTaskProcessed?: (taskId: string, statusCode: number, elapsed: number) => void;
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

  constructor(config: AgentStoredConfig, options?: PollerOptions) {
    this.config = config;
    this.client = new AgentApiClient(config.serverUrl, config.token);
    this.baseIntervalMs = options?.basePollIntervalMs || 1500;
    this.maxIntervalMs = options?.maxPollIntervalMs || 5000;
    this.heartbeatIntervalMs = options?.heartbeatIntervalMs || 30000;
    this.currentIntervalMs = this.baseIntervalMs;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`[FaultLab Agent] Starting poller for agent "${this.config.agentName}"...`);
    console.log(`[FaultLab Agent] Approved local origin: ${this.config.approvedOrigin}`);
    console.log(`[FaultLab Agent] Connected to: ${this.config.serverUrl}`);

    // Send immediate initial heartbeat
    try {
      await this.client.heartbeat();
      console.log(`[FaultLab Agent] Heartbeat acknowledged by server (ONLINE).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('AGENT_REVOKED_OR_UNAUTHORIZED')) {
        console.error(`[FaultLab Agent] ERROR: This agent token is invalid or has been revoked.`);
        this.stop();
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
        // Idle: apply exponential backoff
        this.currentIntervalMs = Math.min(this.currentIntervalMs * 1.5, this.maxIntervalMs);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('AGENT_REVOKED_OR_UNAUTHORIZED')) {
        console.error(`[FaultLab Agent] Agent has been revoked by the project owner. Exiting.`);
        this.stop();
        return;
      }
      // Connection failure to server, back off
      this.currentIntervalMs = this.maxIntervalMs;
    }

    this.scheduleNextPoll(this.currentIntervalMs);
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

