// FaultLab - Phase 9: Local Diagnostic Agent Controller

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { agentService } from './agent.service.js';
import {
  requestPairingSchema,
  agentPairExchangeSchema,
  agentHeartbeatSchema,
  enqueueAgentTaskSchema,
  submitTaskResultSchema,
  projectIdParamSchema,
  agentIdParamSchema,
  taskIdParamSchema,
} from './agent.schemas.js';

export class AgentController {
  // ─── Project / User Management Handlers ─────────────────────────────────────

  /**
   * POST /api/v1/projects/:projectId/agents/pair
   */
  async requestPairing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = projectIdParamSchema.parse(req.params);
      const parsedBody = requestPairingSchema.parse(req.body);
      const userId = req.user!.id;

      const session = await agentService.requestPairingSession(userId, projectId, parsedBody);

      res.status(201).json({
        status: 'success',
        message: 'Agent pairing session created successfully',
        session,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: error.errors[0]?.message || 'Validation error',
          errors: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * GET /api/v1/projects/:projectId/agents
   */
  async listProjectAgents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = projectIdParamSchema.parse(req.params);
      const userId = req.user!.id;

      const agents = await agentService.listProjectAgents(userId, projectId);

      res.status(200).json({
        status: 'success',
        agents,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: error.errors[0]?.message || 'Validation error',
          errors: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * DELETE /api/v1/projects/:projectId/agents/:agentId
   */
  async revokeAgent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = projectIdParamSchema.parse(req.params);
      const { agentId } = agentIdParamSchema.parse(req.params);
      const userId = req.user!.id;

      const revoked = await agentService.revokeAgent(userId, projectId, agentId);

      res.status(200).json({
        status: 'success',
        message: 'Agent credentials revoked successfully',
        agent: revoked,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: error.errors[0]?.message || 'Validation error',
          errors: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * POST /api/v1/projects/:projectId/agents/execute
   */
  async enqueueTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = projectIdParamSchema.parse(req.params);
      const parsedBody = enqueueAgentTaskSchema.parse(req.body);
      const userId = req.user!.id;

      const task = await agentService.enqueueTask(userId, projectId, parsedBody as any);

      res.status(201).json({
        status: 'success',
        message: 'Local execution task enqueued for agent',
        task,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: error.errors[0]?.message || 'Validation error',
          errors: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * GET /api/v1/projects/:projectId/agents/tasks/:taskId
   */
  async getTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = projectIdParamSchema.parse(req.params);
      const { taskId } = taskIdParamSchema.parse(req.params);
      const userId = req.user!.id;

      const task = await agentService.getTask(userId, projectId, taskId);

      res.status(200).json({
        status: 'success',
        task,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: error.errors[0]?.message || 'Validation error',
          errors: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  // ─── Agent-Facing Handlers ──────────────────────────────────────────────────

  /**
   * POST /api/v1/agent/pair
   * Public endpoint for pairing code exchange.
   */
  async pairExchange(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = agentPairExchangeSchema.parse(req.body);
      const credentials = await agentService.exchangePairingCode(parsedBody);

      res.status(200).json({
        status: 'success',
        message: 'Agent paired successfully',
        ...credentials,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: error.errors[0]?.message || 'Validation error',
          errors: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * POST /api/v1/agent/heartbeat
   * Authenticated by agent token.
   */
  async heartbeat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const agentId = req.agent!.id;
      const parsedBody = agentHeartbeatSchema.parse(req.body);

      const heartbeatRes = await agentService.heartbeat(agentId, parsedBody.systemInfo);

      res.status(200).json({
        status: 'success',
        agentStatus: 'ONLINE',
        approvedOrigin: heartbeatRes.approvedOrigin,
        pendingTasks: heartbeatRes.pendingTasksCount,
        pendingTasksCount: heartbeatRes.pendingTasksCount,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/agent/tasks
   * Authenticated by agent token.
   */
  async pollTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const agentId = req.agent!.id;
      const task = await agentService.pollNextPendingTask(agentId);

      res.status(200).json({
        status: 'success',
        task,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/agent/tasks/:taskId/result
   * Authenticated by agent token.
   */
  async submitResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const agentId = req.agent!.id;
      const { taskId } = taskIdParamSchema.parse(req.params);
      const parsedBody = submitTaskResultSchema.parse(req.body);

      const result = await agentService.submitTaskResult(agentId, taskId, parsedBody as any);

      res.status(200).json({
        status: 'success',
        message: 'Task result processed and evaluated',
        ...result,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: error.errors[0]?.message || 'Validation error',
          errors: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * POST /api/v1/agent/disconnect
   * Authenticated by agent token.
   */
  async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const agentId = req.agent!.id;
      await agentService.disconnectAgent(agentId);

      res.status(200).json({
        status: 'success',
        message: 'Agent disconnected',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const agentController = new AgentController();
