import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../utils/prisma.js';
import { env } from '../../config/env.js';
import type { User } from '@prisma/client';
import type { SafeUser, AuthJwtPayload } from './auth.types.js';
import type { RegisterSchemaInput, LoginSchemaInput } from './auth.schemas.js';

const BCRYPT_SALT_ROUNDS = 12;

export class AuthService {
  /**
   * Sanitizes a Prisma User model into a SafeUser representation,
   * guaranteeing that passwordHash is never leaked to callers or API consumers.
   */
  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Signs a standard JWT access token containing subject (user ID) and email.
   */
  generateToken(user: SafeUser): string {
    const payload: AuthJwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  /**
   * Registers a new user account with hashed password credentials.
   */
  async register(input: RegisterSchemaInput): Promise<{ user: SafeUser; token: string }> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // Check for existing user with normalized email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      const error = new Error('An account with this email address already exists') as Error & {
        statusCode: number;
      };
      error.statusCode = 409;
      throw error;
    }

    // Hash password with bcrypt (work factor 12)
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

    // Persist new user in PostgreSQL
    const createdUser = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash,
      },
    });

    const safeUser = this.toSafeUser(createdUser);
    const token = this.generateToken(safeUser);

    return { user: safeUser, token };
  }

  /**
   * Authenticates user credentials and returns safe profile with signed JWT.
   */
  async login(input: LoginSchemaInput): Promise<{ user: SafeUser; token: string }> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // Generic error to prevent user enumeration attacks
    const invalidCredentialsError = new Error('Invalid email or password') as Error & {
      statusCode: number;
    };
    invalidCredentialsError.statusCode = 401;

    // Look up user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw invalidCredentialsError;
    }

    // Compare supplied password with stored bcrypt hash
    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw invalidCredentialsError;
    }

    const safeUser = this.toSafeUser(user);
    const token = this.generateToken(safeUser);

    return { user: safeUser, token };
  }

  /**
   * Retrieves safe profile for currently authenticated user ID.
   */
  async getMe(userId: string): Promise<SafeUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      const error = new Error('User account not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return this.toSafeUser(user);
  }
}

export const authService = new AuthService();

