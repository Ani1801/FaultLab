import type { Request, Response, NextFunction, CookieOptions } from 'express';
import { env } from '../../config/env.js';
import { authService } from './auth.service.js';
import { registerSchema, loginSchema } from './auth.schemas.js';

export const getAuthCookieOptions = (): CookieOptions => {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'lax' : 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  };
};

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = registerSchema.safeParse(req.body);

      if (!parsedBody.success) {
        res.status(400).json({
          status: 'error',
          message: parsedBody.error.errors[0]?.message || 'Invalid registration data',
          details: parsedBody.error.format(),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { user, token } = await authService.register(parsedBody.data);

      // Establish session via secure HttpOnly cookie
      res.cookie(env.COOKIE_NAME, token, getAuthCookieOptions());

      res.status(201).json({
        status: 'success',
        message: 'Account created successfully',
        user,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = loginSchema.safeParse(req.body);

      if (!parsedBody.success) {
        res.status(400).json({
          status: 'error',
          message: parsedBody.error.errors[0]?.message || 'Invalid login credentials',
          details: parsedBody.error.format(),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { user, token } = await authService.login(parsedBody.data);

      // Establish session via secure HttpOnly cookie
      res.cookie(env.COOKIE_NAME, token, getAuthCookieOptions());

      res.status(200).json({
        status: 'success',
        message: 'Signed in successfully',
        user,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Identity is strictly sourced from verified JWT (req.user), NEVER client input
      if (!req.user || !req.user.id) {
        res.status(401).json({
          status: 'error',
          message: 'Unauthorized identity',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const user = await authService.getMe(req.user.id);

      res.status(200).json({
        status: 'success',
        user,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Clear authentication cookie with identical path and security flags
      res.clearCookie(env.COOKIE_NAME, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();

