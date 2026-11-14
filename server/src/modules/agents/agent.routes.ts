// FaultLab - Phase 9: Local Diagnostic Agent Routes

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireAgentAuth } from './agent.middleware.js';
import { agentController } from './agent.controller.js';
import {
  pairingGenRateLimiter,
  pairingExchangeRateLimiter,
  agentRuntimeRateLimiter,
} from '../../middleware/rateLimiter.js';

// ─── 1. Project Agent Management Router ───────────────────────────────────────
// Mounted at /api/v1/projects/:projectId/agents
export const projectAgentsRouter = Router({ mergeParams: true });
projectAgentsRouter.use(requireAuth);

projectAgentsRouter.post('/pair', pairingGenRateLimiter, (req, res, next) =>
  agentController.requestPairing(req, res, next)
);

projectAgentsRouter.get('/', (req, res, next) =>
  agentController.listProjectAgents(req, res, next)
);

projectAgentsRouter.delete('/:agentId', (req, res, next) =>
  agentController.revokeAgent(req, res, next)
);

projectAgentsRouter.post('/execute', (req, res, next) =>
  agentController.enqueueTask(req, res, next)
);

projectAgentsRouter.get('/tasks/:taskId', (req, res, next) =>
  agentController.getTask(req, res, next)
);

// ─── 2. Agent Runtime Router ──────────────────────────────────────────────────
// Mounted at /api/v1/agent
export const agentRuntimeRouter = Router();

// Public pairing exchange (rate limited against brute force)
agentRuntimeRouter.post('/pair', pairingExchangeRateLimiter, (req, res, next) =>
  agentController.pairExchange(req, res, next)
);

// Protected agent endpoints (require agent authentication token, protected by high-capacity runtime limiter)
agentRuntimeRouter.use(agentRuntimeRateLimiter);

agentRuntimeRouter.post('/heartbeat', requireAgentAuth, (req, res, next) =>
  agentController.heartbeat(req, res, next)
);

agentRuntimeRouter.get('/tasks', requireAgentAuth, (req, res, next) =>
  agentController.pollTask(req, res, next)
);

agentRuntimeRouter.post('/tasks/:taskId/result', requireAgentAuth, (req, res, next) =>
  agentController.submitResult(req, res, next)
);

agentRuntimeRouter.post('/disconnect', requireAgentAuth, (req, res, next) =>
  agentController.disconnect(req, res, next)
);

