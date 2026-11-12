// FaultLab - Phase 9: Agent Authentication Middleware

import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../../utils/prisma.js';

// Extend Express Request interface to include agent
declare global {
  namespace Express {
    interface Request {
      agent?: {
        id: string;
        projectId: string;
        name: string;
        approvedOrigin: string;
        status: string;
      };
    }
  }
}

export async function requireAgentAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined = req.headers['x-faultlab-agent-token'] as string | undefined;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7).trim();
    }

    if (!token) {
      res.status(401).json({
        status: 'error',
        message: 'Agent authentication token required. Provide X-FaultLab-Agent-Token header.',
      });
      return;
    }

    // SHA-256 hash of provided token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const agent = await prisma.localAgent.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        projectId: true,
        name: true,
        approvedOrigin: true,
        status: true,
      },
    });

    if (!agent) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid agent credentials.',
      });
      return;
    }

    if (agent.status === 'REVOKED') {
      res.status(403).json({
        status: 'error',
        message: 'Agent credential has been revoked.',
      });
      return;
    }

    req.agent = agent;
    next();
  } catch (error) {
    next(error);
  }
}

