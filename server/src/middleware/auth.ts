import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { AuthJwtPayload } from '../modules/auth/auth.types.js';

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // 1. Read token from HttpOnly cookie first, with fallback to Authorization Bearer header
    let token: string | undefined = req.cookies?.[env.COOKIE_NAME];

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7).trim();
    }

    if (!token) {
      res.status(401).json({
        status: 'error',
        message: 'Authentication required. Please sign in.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 2. Verify signature and expiration
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthJwtPayload;

    if (!decoded || !decoded.sub) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid authentication token payload.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 3. Attach authenticated identity to Express Request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        status: 'error',
        message: 'Authentication token has expired. Please sign in again.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid authentication token.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(401).json({
      status: 'error',
      message: 'Authentication failed.',
      timestamp: new Date().toISOString(),
    });
  }
};

