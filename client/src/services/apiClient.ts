import { ApiError } from '../types/api';

const DEFAULT_DEV_BASE_URL = 'http://localhost:5000/api/v1';

export const getApiBaseUrl = (): string => {
  // If explicitly configured via environment variable, honor it (stripping any trailing slash)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }
  // In production builds (e.g. deployed on Vercel), use relative path to route through Vercel reverse proxy
  if (import.meta.env.PROD) {
    return '/api/v1';
  }
  // In local development, communicate directly with local backend
  return DEFAULT_DEV_BASE_URL;
};

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  coldStartTolerance?: boolean;
  maxRetries?: number;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getApiBaseUrl();
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const {
      timeoutMs: userTimeout,
      coldStartTolerance = false,
      maxRetries = coldStartTolerance ? 1 : 0,
      headers = {},
      signal: callerSignal,
      ...customConfig
    } = options;

    const method = (customConfig.method || 'GET').toUpperCase();
    const isIdempotent = method === 'GET' || method === 'HEAD';
    // Cold start tolerance grants a 50s window; standard interactive requests use 10s
    const timeoutMs = userTimeout ?? (coldStartTolerance ? 50000 : 10000);
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    let attempt = 0;
    const allowedRetries = isIdempotent ? Math.min(maxRetries, 1) : 0;

    while (true) {
      const controller = new AbortController();
      let isTimedOut = false;

      // Internal timeout timer
      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        controller.abort();
      }, timeoutMs);

      // Link external caller cancellation signal to our controller
      const onCallerAbort = () => {
        controller.abort(callerSignal?.reason);
      };

      if (callerSignal) {
        if (callerSignal.aborted) {
          clearTimeout(timeoutId);
          throw new ApiError('Request was cancelled by user', 0);
        }
        callerSignal.addEventListener('abort', onCallerAbort, { once: true });
      }

      try {
        const response = await fetch(url, {
          ...customConfig,
          signal: controller.signal,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...headers,
          },
        });

        clearTimeout(timeoutId);
        if (callerSignal) {
          callerSignal.removeEventListener('abort', onCallerAbort);
        }

        // Retry on 502/503/504 gateway errors when coldStartTolerance is active and request is idempotent
        if (
          isIdempotent &&
          attempt < allowedRetries &&
          [502, 503, 504].includes(response.status) &&
          !callerSignal?.aborted
        ) {
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');
        const data = isJson ? await response.json() : await response.text();

        if (!response.ok) {
          const errorMessage =
            (isJson && data && typeof data === 'object' && 'message' in data && (data as { message: string }).message) ||
            `Request failed with status ${response.status}`;
          throw new ApiError(errorMessage, response.status, data);
        }

        return data as T;
      } catch (error) {
        clearTimeout(timeoutId);
        if (callerSignal) {
          callerSignal.removeEventListener('abort', onCallerAbort);
        }

        if (callerSignal?.aborted) {
          throw new ApiError('Request was cancelled by user', 0);
        }

        if (error instanceof ApiError) {
          throw error;
        }

        // Check if retryable network or timeout error on idempotent request
        const isNetworkOrTimeout =
          isTimedOut || (error instanceof DOMException && error.name === 'AbortError');

        if (isIdempotent && attempt < allowedRetries && isNetworkOrTimeout && !callerSignal?.aborted) {
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        if (isTimedOut) {
          const msg = coldStartTolerance
            ? 'The backend server is starting up after inactivity (cold start). Please wait a moment and try again.'
            : 'Request timed out';
          throw new ApiError(msg, 408);
        }

        const message = error instanceof Error ? error.message : 'Network error or backend is unreachable';
        throw new ApiError(message, 0);
      }
    }
  }

  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();

