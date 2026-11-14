// FaultLab - Phase 8: Diagnostic Routes

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { diagnosticController } from './diagnostic.controller.js';
import { diagnosticRateLimiter } from '../../middleware/rateLimiter.js';
import { diagnosticConcurrencyLimiter } from '../../middleware/concurrencyLimiter.js';

// GET /api/v1/api-test-runs/:runId/diagnostics
export const diagnosticRunRouter = Router({ mergeParams: true });
diagnosticRunRouter.use(requireAuth);
diagnosticRunRouter.get('/', diagnosticController.getDiagnosticByRunId.bind(diagnosticController));

// GET /api/v1/projects/:projectId/diagnostics
// GET /api/v1/projects/:projectId/diagnostics/summary
export const projectDiagnosticsRouter = Router({ mergeParams: true });
projectDiagnosticsRouter.use(requireAuth);
projectDiagnosticsRouter.use(diagnosticRateLimiter);
projectDiagnosticsRouter.use(diagnosticConcurrencyLimiter);
projectDiagnosticsRouter.get('/summary', diagnosticController.getProjectDiagnosticSummary.bind(diagnosticController));
projectDiagnosticsRouter.get('/', diagnosticController.listProjectDiagnostics.bind(diagnosticController));
