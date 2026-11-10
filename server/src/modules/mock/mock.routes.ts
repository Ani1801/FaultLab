import { Router, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { prisma } from '../../utils/prisma.js';
import { normalizePath } from '../endpoints/endpoint.schemas.js';
import { requestLogService } from '../requests/requestLog.service.js';

export const mockRouter = Router();

// Enable permissive CORS for mock simulation runtime so external apps and tools can query endpoints
mockRouter.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['*'],
  })
);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteMatch {
  matches: boolean;
  score: number;
}

/**
 * Compares an endpoint path pattern (e.g. /users/:id) against an incoming request path (e.g. /users/123).
 * Returns whether it matches and a static segment score to prioritize more specific routes.
 */
function matchPathPattern(pattern: string, actualPath: string): RouteMatch {
  const patternSegments = pattern.split('/').filter(Boolean);
  const actualSegments = actualPath.split('/').filter(Boolean);

  if (patternSegments.length !== actualSegments.length) {
    return { matches: false, score: 0 };
  }

  let staticScore = 0;
  for (let i = 0; i < patternSegments.length; i++) {
    const p = patternSegments[i];
    const a = actualSegments[i];

    if (!p || !a) {
      return { matches: false, score: 0 };
    }

    if (p.startsWith(':')) {
      // Dynamic route parameter segment matches any non-empty value
      continue;
    }

    if (p !== a) {
      return { matches: false, score: 0 };
    }

    staticScore++;
  }

  return { matches: true, score: staticScore };
}

/**
 * Handles incoming simulation requests.
 * Records request execution metrics and history asynchronously without delaying responses.
 */
async function handleMockRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  const startTime = Date.now();

  try {
    const rawProjectId = req.params.projectId;
    const projectId = typeof rawProjectId === 'string' ? rawProjectId : '';
    const rawSubpath = req.params[0] ? `/${req.params[0]}` : '/';
    const subpath = normalizePath(rawSubpath);
    const method = req.method.toUpperCase();

    // Calculate approximate request size
    const rawContentLength = req.headers['content-length'];
    const requestSize = rawContentLength
      ? parseInt(rawContentLength, 10)
      : req.body && Object.keys(req.body).length > 0
      ? Buffer.byteLength(JSON.stringify(req.body), 'utf8')
      : 0;

    // 1. Validate Project ID format
    if (!projectId || !UUID_REGEX.test(projectId)) {
      res.status(404).json({
        error: 'Mock endpoint not found',
        message: `Invalid project ID format: "${projectId}"`,
        projectId,
        method,
        path: subpath,
      });
      return;
    }

    // 2. Fetch project existence and configured endpoints for this project
    const [project, endpoints] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      }),
      prisma.mockEndpoint.findMany({
        where: { projectId },
      }),
    ]);

    if (!project) {
      res.status(404).json({
        error: 'Mock endpoint not found',
        message: `Project not found: "${projectId}"`,
        projectId,
        method,
        path: subpath,
      });
      return;
    }

    if (endpoints.length === 0) {
      const notFoundPayload = {
        error: 'Mock endpoint not found',
        message: `No endpoints found for project ID "${projectId}"`,
        projectId,
        method,
        path: subpath,
      };
      res.status(404).json(notFoundPayload);

      // Asynchronously record unmatched request log
      requestLogService
        .recordRequest({
          projectId,
          endpointId: null,
          method,
          path: subpath,
          statusCode: 404,
          responseTime: Math.max(1, Date.now() - startTime),
          requestSize,
          responseSize: Buffer.byteLength(JSON.stringify(notFoundPayload), 'utf8'),
          isFaultInjected: false,
          wasMatched: false,
        })
        .catch(() => {});
      return;
    }

    // 3. Filter endpoints by HTTP method
    const methodCandidates = endpoints.filter((ep) => ep.method === method);

    if (methodCandidates.length === 0) {
      const notFoundPayload = {
        error: 'Mock endpoint not found',
        message: `No mock endpoint configured for [${method}] ${subpath} in project ${projectId}`,
        projectId,
        method,
        path: subpath,
      };
      res.status(404).json(notFoundPayload);

      // Asynchronously record unmatched request log
      requestLogService
        .recordRequest({
          projectId,
          endpointId: null,
          method,
          path: subpath,
          statusCode: 404,
          responseTime: Math.max(1, Date.now() - startTime),
          requestSize,
          responseSize: Buffer.byteLength(JSON.stringify(notFoundPayload), 'utf8'),
          isFaultInjected: false,
          wasMatched: false,
        })
        .catch(() => {});
      return;
    }

    // 4. Find matching endpoint (prefer exact match, then most specific parameterized route)
    let selectedEndpoint = methodCandidates.find((ep) => ep.path === subpath);

    if (!selectedEndpoint) {
      const scoredCandidates: Array<{ endpoint: (typeof methodCandidates)[0]; score: number }> = [];

      for (const candidate of methodCandidates) {
        const { matches, score } = matchPathPattern(candidate.path, subpath);
        if (matches) {
          scoredCandidates.push({ endpoint: candidate, score });
        }
      }

      if (scoredCandidates.length > 0) {
        // Sort descending by static score (most specific first)
        scoredCandidates.sort((a, b) => b.score - a.score);
        const topCandidate = scoredCandidates[0];
        if (topCandidate) {
          selectedEndpoint = topCandidate.endpoint;
        }
      }
    }

    if (!selectedEndpoint) {
      const notFoundPayload = {
        error: 'Mock endpoint not found',
        message: `No mock endpoint configured for [${method}] ${subpath} in project ${projectId}`,
        projectId,
        method,
        path: subpath,
      };
      res.status(404).json(notFoundPayload);

      // Asynchronously record unmatched request log
      requestLogService
        .recordRequest({
          projectId,
          endpointId: null,
          method,
          path: subpath,
          statusCode: 404,
          responseTime: Math.max(1, Date.now() - startTime),
          requestSize,
          responseSize: Buffer.byteLength(JSON.stringify(notFoundPayload), 'utf8'),
          isFaultInjected: false,
          wasMatched: false,
        })
        .catch(() => {});
      return;
    }

    // 5. Calculate and apply latency (normal responseDelay + additionalDelay if faultEnabled)
    let totalDelay = selectedEndpoint.responseDelay;
    if (selectedEndpoint.faultEnabled && selectedEndpoint.additionalDelay > 0) {
      totalDelay += selectedEndpoint.additionalDelay;
    }

    if (totalDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }

    // 6. Set custom response headers if configured
    if (
      selectedEndpoint.responseHeaders &&
      typeof selectedEndpoint.responseHeaders === 'object' &&
      !Array.isArray(selectedEndpoint.responseHeaders)
    ) {
      for (const [key, value] of Object.entries(selectedEndpoint.responseHeaders)) {
        if (value !== null && value !== undefined) {
          res.setHeader(key, String(value));
        }
      }
    }

    // 7. Evaluate Fault Injection behavior
    let shouldInjectFault = false;
    if (selectedEndpoint.faultEnabled) {
      if (selectedEndpoint.failureMode === 'ALWAYS') {
        shouldInjectFault = true;
      } else if (selectedEndpoint.failureMode === 'RANDOM') {
        const roll = Math.random() * 100;
        shouldInjectFault = roll < selectedEndpoint.failureRate;
      }
    }

    if (shouldInjectFault) {
      const failureStatus = selectedEndpoint.failureStatusCode || 500;
      const failureBody =
        selectedEndpoint.failureResponseBody !== undefined && selectedEndpoint.failureResponseBody !== null
          ? selectedEndpoint.failureResponseBody
          : { error: 'Internal Server Error', message: 'Simulated fault injection' };

      const responseSize = Buffer.byteLength(JSON.stringify(failureBody), 'utf8');
      const responseTime = Math.max(1, Date.now() - startTime);

      res.status(failureStatus).json(failureBody);

      // Non-blocking log recording
      requestLogService
        .recordRequest({
          projectId,
          endpointId: selectedEndpoint.id,
          method,
          path: subpath,
          statusCode: failureStatus,
          responseTime,
          requestSize,
          responseSize,
          isFaultInjected: true,
          wasMatched: true,
        })
        .catch(() => {});
      return;
    }

    // 8. Normal simulated response
    if (selectedEndpoint.statusCode === 204) {
      const responseTime = Math.max(1, Date.now() - startTime);
      res.status(204).end();

      // Non-blocking log recording
      requestLogService
        .recordRequest({
          projectId,
          endpointId: selectedEndpoint.id,
          method,
          path: subpath,
          statusCode: 204,
          responseTime,
          requestSize,
          responseSize: 0,
          isFaultInjected: false,
          wasMatched: true,
        })
        .catch(() => {});
      return;
    }

    const responseBody = selectedEndpoint.responseBody ?? {};
    const responseSize = Buffer.byteLength(JSON.stringify(responseBody), 'utf8');
    const responseTime = Math.max(1, Date.now() - startTime);

    res.status(selectedEndpoint.statusCode).json(responseBody);

    // Non-blocking log recording
    requestLogService
      .recordRequest({
        projectId,
        endpointId: selectedEndpoint.id,
        method,
        path: subpath,
        statusCode: selectedEndpoint.statusCode,
        responseTime,
        requestSize,
        responseSize,
        isFaultInjected: false,
        wasMatched: true,
      })
      .catch(() => {});
  } catch (error) {
    next(error);
  }
}

// Support both /mock/:projectId and /mock/:projectId/* for any HTTP method
mockRouter.all('/:projectId', handleMockRequest);
mockRouter.all('/:projectId/*', handleMockRequest);
