import { apiClient } from './apiClient';
import type { User, LoginCredentials, RegisterData, AuthSuccessResponse } from '../types/auth';

export const authService = {
  /**
   * Registers a new user account.
   * The backend sets an HttpOnly session cookie on success.
   */
  async register(data: RegisterData): Promise<User> {
    const response = await apiClient.post<AuthSuccessResponse>('/auth/register', data);
    return response.user;
  },

  /**
   * Authenticates user with email and password.
   * The backend sets an HttpOnly session cookie on success.
   */
  async login(credentials: LoginCredentials): Promise<User> {
    const response = await apiClient.post<AuthSuccessResponse>('/auth/login', credentials);
    return response.user;
  },

  /**
   * Fetches the currently authenticated user's profile using the session cookie.
   */
  async getMe(): Promise<User> {
    const response = await apiClient.get<AuthSuccessResponse>('/auth/me', { coldStartTolerance: true });
    return response.user;
  },

  /**
   * Clears the session cookie on the backend.
   */
  async logout(): Promise<void> {
    await apiClient.post<{ status: string; message: string }>('/auth/logout');
  },
};

