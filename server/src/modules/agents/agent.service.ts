// FaultLab - Phase 9: Local Diagnostic Agent Service
// Handles pairing generation, exchange, agent registration, heartbeats,
// task queueing, execution evaluation, and Phase 8 diagnostic engine integration.

import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../../utils/prisma.js';
import { evaluateTestAssertions } from '../api-testing/assertion.engine.js';
import { diagnosticService } from '../diagnostics/diagnostic.service.js';
import type {
  RequestPairingDTO,
  PairingSessionResponse,
  AgentPairExchangeDTO,
  AgentPairExchangeResponse,
  LocalAgentResponse,
  EnqueueAgentTaskDTO,
  AgentTaskResponse,
  AgentTaskExecutionResult,
  AgentHeartbeatResponse,
} from './agent.types.js';

export class AgentService {
  /**
   * Helper to verify project ownership through the workspace hierarchy.
   */
  private async verifyProjectOwnership(userId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: { ownerId: userId },
      },
      select: { id: true, name: true },
    });

    if (!project) {
      const error = new Error('Project not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return project;
  }

  /**
   * Helper to format a LocalAgent database record into a safe sanitized response.
   * Guarantees tokenHash is NEVER returned.
   */
  private formatAgentResponse(agent: any): LocalAgentResponse {
    return {
      id: agent.id,
      projectId: agent.projectId,
      name: agent.name,
      approvedOrigin: agent.approvedOrigin,
      status: agent.status,
      lastSeenAt: agent.lastSeenAt ? agent.lastSeenAt.toISOString() : null,
      systemInfo: agent.systemInfo || null,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
    };
  }

  // ─── 1. Pairing Flow ────────────────────────────────────────────────────────

  /**
   * Requests a new agent pairing session.
   * Generates a cryptographically secure, short-lived (10m), single-use pairing code.
   */
  async requestPairingSession(
    userId: string,
    projectId: string,
    dto: RequestPairingDTO
  ): Promise<PairingSessionResponse> {
    await this.verifyProjectOwnership(userId, projectId);

    // Invalidate any existing unused pairing sessions for this project
    await prisma.agentPairingSession.updateMany({
      where: { projectId, isUsed: false },
      data: { isUsed: true },
    });

    // Generate pairing code: FLAB-XXXX-YYYY (4 hex chars each)
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const pairingCode = `FLAB-${part1}-${part2}`;

    // SHA-256 hash for secure storage
    const codeHash = crypto.createHash('sha256').update(pairingCode).digest('hex');

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.agentPairingSession.create({
      data: {
        projectId,
        codeHash,
        approvedOrigin: dto.approvedOrigin,
        agentName: dto.agentName || null,
        expiresAt,
        isUsed: false,
      },
    });

    const serverUrl = env.PUBLIC_API_BASE_URL;
    const instructions = `Run in your local terminal: node packages/faultlab-agent/dist/cli.js connect --code ${pairingCode} --server ${serverUrl} --origin ${dto.approvedOrigin}`;

    return {
      pairingCode,
      approvedOrigin: dto.approvedOrigin,
      expiresAt: expiresAt.toISOString(),
      instructions,
      connectCommand: instructions,
    };
  }

  /**
   * Exchanges a valid pairing code for an agent authentication credential.
   * Single-use only, enforces expiration, generates a unique agent secret token.
   */
  async exchangePairingCode(dto: AgentPairExchangeDTO): Promise<AgentPairExchangeResponse> {
    const codeHash = crypto.createHash('sha256').update(dto.pairingCode.trim()).digest('hex');

    const session = await prisma.agentPairingSession.findUnique({
      where: { codeHash },
      include: { project: { select: { id: true, name: true } } },
    });

    if (!session) {
      const error = new Error('Invalid pairing code') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    if (session.isUsed) {
      const error = new Error('Pairing code has already been used') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    if (new Date() > session.expiresAt) {
      const error = new Error('Pairing code has expired') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Mark pairing session as used immediately
    await prisma.agentPairingSession.update({
      where: { id: session.id },
      data: { isUsed: true, usedAt: new Date() },
    });

    // Generate revocable agent secret token: fla_<64 hex chars>
    const agentToken = `fla_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(agentToken).digest('hex');

    const agentName = dto.deviceName.trim() || session.agentName || 'Local Developer Machine';

    // Mark existing active agents for this approved origin in this project as OFFLINE
    await prisma.localAgent.updateMany({
      where: {
        projectId: session.projectId,
        approvedOrigin: session.approvedOrigin,
        status: 'ONLINE',
      },
      data: { status: 'OFFLINE' },
    });

    const agent = await prisma.localAgent.create({
      data: {
        projectId: session.projectId,
        name: agentName,
        tokenHash,
        approvedOrigin: session.approvedOrigin,
        status: 'ONLINE',
        lastSeenAt: new Date(),
        systemInfo: dto.systemInfo || {},
      },
    });

    return {
      agentId: agent.id,
      agentToken,
      token: agentToken,
      name: agent.name,
      approvedOrigin: agent.approvedOrigin,
      projectId: session.projectId,
      projectName: session.project.name,
    };
  }

  // ─── 2. Agent Management ────────────────────────────────────────────────────

  /**
   * Lists all local agents connected to a project.
   * Automatically transitions stale ONLINE agents (>45s since last heartbeat) to OFFLINE.
   * REVOKED agents are permanent and are NEVER overwritten.
   */
  async listProjectAgents(userId: string, projectId: string): Promise<LocalAgentResponse[]> {
    await this.verifyProjectOwnership(userId, projectId);

    const staleThreshold = new Date(Date.now() - 45 * 1000); // 45s heartbeat timeout

    // Transition stale ONLINE agents to OFFLINE (strictly preserving REVOKED status)
    await prisma.localAgent.updateMany({
      where: {
        projectId,
        status: 'ONLINE',
        OR: [
          { lastSeenAt: { lt: staleThreshold } },
          { lastSeenAt: null },
        ],
      },
      data: { status: 'OFFLINE' },
    });

    const agents = await prisma.localAgent.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return agents.map((a) => this.formatAgentResponse(a));
  }

  /**
   * Revokes an agent's credentials immediately and permanently.
   */
  async revokeAgent(userId: string, projectId: string, agentId: string): Promise<LocalAgentResponse> {
    await this.verifyProjectOwnership(userId, projectId);

    const agent = await prisma.localAgent.findFirst({
      where: { id: agentId, projectId },
    });

    if (!agent) {
      const error = new Error('Agent not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const updated = await prisma.localAgent.update({
      where: { id: agentId },
      data: { status: 'REVOKED' },
    });

    return {
      id: updated.id,
      projectId: updated.projectId,
      name: updated.name,
      approvedOrigin: updated.approvedOrigin,
      status: updated.status,
      lastSeenAt: updated.lastSeenAt ? updated.lastSeenAt.toISOString() : null,
      systemInfo: updated.systemInfo as any,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ─── 3. Agent Runtime Communication ─────────────────────────────────────────

  /**
   * Heartbeat from connected local agent.
   * Heartbeats must NEVER reactivate a REVOKED agent.
   */
  async heartbeat(agentId: string, systemInfo?: Record<string, any>): Promise<AgentHeartbeatResponse> {
    const agent = await prisma.localAgent.findUnique({
      where: { id: agentId },
      select: { id: true, approvedOrigin: true, status: true },
    });

    if (!agent) {
      const error = new Error('Agent not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    if (agent.status === 'REVOKED') {
      const error = new Error('Agent credential has been revoked') as Error & { statusCode: number };
      error.statusCode = 403;
      throw error;
    }

    await prisma.localAgent.update({
      where: { id: agentId },
      data: {
        lastSeenAt: new Date(),
        status: 'ONLINE',
        ...(systemInfo ? { systemInfo } : {}),
      },
    });

    const pendingTasksCount = await prisma.agentTask.count({
      where: { agentId, status: 'PENDING', expiresAt: { gt: new Date() } },
    });

    return {
      status: 'ok',
      approvedOrigin: agent.approvedOrigin,
      pendingTasksCount,
    };
  }

  /**
   * Graceful disconnection from local agent.
   * Must NEVER overwrite a REVOKED status.
   */
  async disconnectAgent(agentId: string): Promise<void> {
    await prisma.localAgent.updateMany({
      where: { id: agentId, status: { not: 'REVOKED' } },
      data: { status: 'OFFLINE' },
    });
  }

  // ─── 4. Task Queueing & Execution Evaluation ────────────────────────────────

  /**
   * Enqueues an API test task for the connected local agent.
   */
  async enqueueTask(
    userId: string,
    projectId: string,
    dto: EnqueueAgentTaskDTO
  ): Promise<AgentTaskResponse> {
    await this.verifyProjectOwnership(userId, projectId);

    const agent = await prisma.localAgent.findFirst({
      where: { id: dto.agentId, projectId },
    });

    if (!agent) {
      const error = new Error('Local agent not found for this project') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    if (agent.status === 'REVOKED') {
      const error = new Error('Local agent credentials have been revoked') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const expiresAt = new Date(Date.now() + 60 * 1000); // 60s timeout for task pickup

    const task = await prisma.agentTask.create({
      data: {
        agentId: dto.agentId,
        projectId,
        type: 'EXECUTE_API_TEST',
        status: 'PENDING',
        payload: {
          ...dto.payload,
          saveRun: dto.saveRun !== false,
          apiTestId: dto.apiTestId || null,
        } as any,
        expiresAt,
      },
    });

    return {
      id: task.id,
      agentId: task.agentId,
      projectId: task.projectId,
      type: task.type,
      status: task.status as any,
      payload: task.payload as any,
      expiresAt: task.expiresAt.toISOString(),
      createdAt: task.createdAt.toISOString(),
    };
  }

  /**
   * Agent polls for its next pending task.
   * Atomically transitions status PENDING -> PICKED_UP.
   */
  async pollNextPendingTask(agentId: string): Promise<AgentTaskResponse | null> {
    const now = new Date();

    // Expire stale pending tasks
    await prisma.agentTask.updateMany({
      where: {
        agentId,
        status: 'PENDING',
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED' },
    });

    // Find oldest pending valid task
    const task = await prisma.agentTask.findFirst({
      where: {
        agentId,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!task) return null;

    // Atomically claim task
    const updated = await prisma.agentTask.update({
      where: { id: task.id },
      data: { status: 'PICKED_UP' },
    });

    return {
      id: updated.id,
      agentId: updated.agentId,
      projectId: updated.projectId,
      type: updated.type,
      status: updated.status as any,
      payload: updated.payload as any,
      expiresAt: updated.expiresAt.toISOString(),
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Submits execution evidence captured by the local agent.
   * Integrates with Phase 7 assertion evaluation and Phase 8 diagnostic engine!
   */
  async submitTaskResult(
    agentId: string,
    taskId: string,
    result: AgentTaskExecutionResult
  ): Promise<{ testRunId?: string; apiTestRunId?: string }> {
    const task = await prisma.agentTask.findFirst({
      where: { id: taskId, agentId },
    });

    if (!task) {
      const error = new Error('Task not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    if (task.status === 'COMPLETED' || task.status === 'FAILED') {
      return { testRunId: task.apiTestRunId || undefined, apiTestRunId: task.apiTestRunId || undefined };
    }

    const payload = task.payload as any;

    // Parse response body if JSON
    let parsedBody: any = null;
    if (result.rawBody) {
      try {
        parsedBody = JSON.parse(result.rawBody);
      } catch {
        parsedBody = null;
      }
    }

    // Evaluate assertions through Phase 7 assertion engine
    const evaluation = evaluateTestAssertions({
      actualStatusCode: result.statusCode,
      actualResponseTime: result.responseTime,
      responseBody: parsedBody,
      expectedStatusCode: payload.expectedStatusCode ?? null,
      maxResponseTime: payload.maxResponseTime ?? null,
      jsonAssertions: payload.expectedResponse || [],
      isExecutionError: result.isExecutionError,
    });

    // Determine task status
    const taskStatus = result.isExecutionError ? 'FAILED' : 'COMPLETED';

    let testRunId: string | null = null;

    // Persist ApiTestRun if saveRun is true (or default)
    if (payload.saveRun !== false) {
      const run = await prisma.apiTestRun.create({
        data: {
          projectId: task.projectId,
          apiTestId: payload.apiTestId || null,
          status: evaluation.status as any,
          actualStatusCode: result.statusCode,
          responseTime: result.responseTime,
          responseSize: result.responseSize,
          responseHeaders: result.responseHeaders,
          assertionResults: evaluation.assertionResults as any,
          sanitizedResponseBody: result.rawBody ? result.rawBody.slice(0, 65536) : null,
          errorMessage: result.errorMessage || null,
        },
      });

      testRunId = run.id;

      // Integrate Phase 8 Diagnostic Engine: generate and persist diagnostic report!
      await diagnosticService.generateAndPersistDiagnostic({
        apiTestRunId: run.id,
        projectId: task.projectId,
        input: {
          method: payload.method,
          url: payload.url,
          authenticationType: 'NONE', // Local agent execution
          isExecutionError: result.isExecutionError,
          statusCode: result.statusCode,
          responseTime: result.responseTime,
          responseHeaders: result.responseHeaders,
          sanitizedResponseBody: result.rawBody ? result.rawBody.slice(0, 65536) : null,
          errorMessage: result.errorMessage || null,
          assertionResults: evaluation.assertionResults,
          maxResponseTime: payload.maxResponseTime ?? null,
          expectedStatusCode: payload.expectedStatusCode ?? null,
          timeoutMs: payload.timeoutMs || 5000,
        },
      });
    }

    // Update task record with result and linked run
    await prisma.agentTask.update({
      where: { id: taskId },
      data: {
        status: taskStatus,
        result: result as any,
        apiTestRunId: testRunId,
        completedAt: new Date(),
      },
    });

    return { testRunId: testRunId || undefined, apiTestRunId: testRunId || undefined };
  }

  /**
   * Retrieves task status and execution results for a project.
   */
  async getTask(userId: string, projectId: string, taskId: string): Promise<AgentTaskResponse> {
    await this.verifyProjectOwnership(userId, projectId);

    const task = await prisma.agentTask.findFirst({
      where: { id: taskId, projectId },
    });

    if (!task) {
      const error = new Error('Task not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    let testRun: any = null;
    let diagnosticReport: any = null;

    if (task.apiTestRunId) {
      const run = await prisma.apiTestRun.findUnique({
        where: { id: task.apiTestRunId },
        include: { diagnosticReport: true },
      });

      if (run) {
        testRun = {
          id: run.id,
          projectId: run.projectId,
          apiTestId: run.apiTestId,
          status: run.status,
          actualStatusCode: run.actualStatusCode,
          responseTime: run.responseTime,
          responseSize: run.responseSize,
          responseHeaders: run.responseHeaders || {},
          assertionResults: run.assertionResults || [],
          sanitizedResponseBody: run.sanitizedResponseBody,
          errorMessage: run.errorMessage,
          executedAt: run.executedAt,
        };

        if (run.diagnosticReport) {
          diagnosticReport = {
            overallStatus: run.diagnosticReport.overallStatus,
            summary: run.diagnosticReport.summary,
            totalFindings: run.diagnosticReport.totalFindings,
            findings: run.diagnosticReport.findings,
            healthScore: run.diagnosticReport.overallStatus === 'HEALTHY' ? 100 : 50,
          };
        }
      }
    }

    return {
      id: task.id,
      agentId: task.agentId,
      projectId: task.projectId,
      type: task.type,
      status: task.status as any,
      payload: task.payload as any,
      result: (task.result as any) || null,
      apiTestRunId: task.apiTestRunId,
      testRun,
      apiTestRun: testRun,
      diagnosticReport,
      expiresAt: task.expiresAt.toISOString(),
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      createdAt: task.createdAt.toISOString(),
    };
  }
}

export const agentService = new AgentService();
