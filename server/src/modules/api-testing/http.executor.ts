import { validateSsrfTarget } from './ssrf.validator.js';

export interface KeyValuePair {
  key: string;
  value: string;
  enabled?: boolean;
}

export interface AuthExecutionConfig {
  type: 'NONE' | 'BEARER' | 'BASIC' | 'API_KEY';
  token?: string;
  username?: string;
  password?: string;
  apiKeyKey?: string;
  apiKeyValue?: string;
  apiKeyAddTo?: 'HEADER' | 'QUERY';
}

export interface ExecuteRequestOptions {
  method: string;
  url: string;
  queryParams?: KeyValuePair[] | Record<string, string> | null;
  headers?: KeyValuePair[] | Record<string, string> | null;
  requestBody?: string | Record<string, any> | null;
  auth?: AuthExecutionConfig | null;
  timeoutMs?: number;
  allowLocalOverride?: boolean;
}

export interface ExecutionResponse {
  isExecutionError: boolean;
  statusCode: number | null;
  responseTime: number;
  responseSize: number;
  responseHeaders: Record<string, string>;
  rawBody: string;
  parsedBody: any;
  errorMessage?: string;
}

const MAX_RESPONSE_BODY_SIZE = 1024 * 1024; // 1 MB max response body capture
const MAX_REDIRECTS = 5;

/**
 * Sanitizes sensitive response headers.
 */
function sanitizeHeaders(headers: Headers): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const sensitiveNames = ['set-cookie', 'authorization', 'x-api-key', 'proxy-authorization'];

  headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (sensitiveNames.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
}

/**
 * Executes a real outbound HTTP request with SSRF protection, redirect verification,
 * credentials injection, response size limits, and accurate latency calculation.
 */
export async function executeRealHttpRequest(
  options: ExecuteRequestOptions
): Promise<ExecutionResponse> {
  const startTime = Date.now();
  const timeoutMs = Math.min(30000, Math.max(100, options.timeoutMs || 5000));
  let currentUrlString = options.url.trim();

  try {
    // 1. Build initial URL with query parameters
    let currentUrl: URL;
    try {
      currentUrl = new URL(currentUrlString);
    } catch {
      return {
        isExecutionError: true,
        statusCode: null,
        responseTime: Date.now() - startTime,
        responseSize: 0,
        responseHeaders: {},
        rawBody: '',
        parsedBody: null,
        errorMessage: `Invalid URL format: "${currentUrlString}"`,
      };
    }

    // Append query parameters
    if (options.queryParams) {
      if (Array.isArray(options.queryParams)) {
        for (const item of options.queryParams) {
          if (item.enabled !== false && item.key) {
            currentUrl.searchParams.append(item.key, item.value || '');
          }
        }
      } else if (typeof options.queryParams === 'object') {
        for (const [k, v] of Object.entries(options.queryParams)) {
          if (k) currentUrl.searchParams.append(k, String(v));
        }
      }
    }

    // Apply API Key if configured to query parameter
    if (
      options.auth &&
      options.auth.type === 'API_KEY' &&
      options.auth.apiKeyAddTo === 'QUERY' &&
      options.auth.apiKeyKey
    ) {
      currentUrl.searchParams.set(options.auth.apiKeyKey, options.auth.apiKeyValue || '');
    }

    // 2. Build Request Headers
    const requestHeaders: Record<string, string> = {};

    if (options.headers) {
      if (Array.isArray(options.headers)) {
        for (const item of options.headers) {
          if (item.enabled !== false && item.key) {
            requestHeaders[item.key] = item.value || '';
          }
        }
      } else if (typeof options.headers === 'object') {
        for (const [k, v] of Object.entries(options.headers)) {
          if (k) requestHeaders[k] = String(v);
        }
      }
    }

    // Apply Authentication headers
    if (options.auth) {
      if (options.auth.type === 'BEARER' && options.auth.token) {
        requestHeaders['Authorization'] = `Bearer ${options.auth.token}`;
      } else if (options.auth.type === 'BASIC' && options.auth.username) {
        const credentials = Buffer.from(
          `${options.auth.username}:${options.auth.password || ''}`
        ).toString('base64');
        requestHeaders['Authorization'] = `Basic ${credentials}`;
      } else if (
        options.auth.type === 'API_KEY' &&
        options.auth.apiKeyAddTo !== 'QUERY' &&
        options.auth.apiKeyKey
      ) {
        requestHeaders[options.auth.apiKeyKey] = options.auth.apiKeyValue || '';
      }
    }

    // 3. Prepare Request Body
    let bodyData: string | undefined;
    const method = options.method.toUpperCase();
    const canHaveBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (canHaveBody && options.requestBody !== undefined && options.requestBody !== null) {
      if (typeof options.requestBody === 'object') {
        bodyData = JSON.stringify(options.requestBody);
        if (!requestHeaders['Content-Type'] && !requestHeaders['content-type']) {
          requestHeaders['Content-Type'] = 'application/json';
        }
      } else if (typeof options.requestBody === 'string' && options.requestBody.trim().length > 0) {
        bodyData = options.requestBody;
        if (!requestHeaders['Content-Type'] && !requestHeaders['content-type']) {
          try {
            JSON.parse(bodyData);
            requestHeaders['Content-Type'] = 'application/json';
          } catch {
            requestHeaders['Content-Type'] = 'text/plain';
          }
        }
      }
    }

    // 4. Execute with Manual Redirect Control and SSRF Revalidation
    let redirectCount = 0;
    let finalResponse: Response | null = null;
    let targetUrlToFetch = currentUrl.toString();

    while (redirectCount <= MAX_REDIRECTS) {
      // Validate SSRF for current target
      const ssrfCheck = await validateSsrfTarget(targetUrlToFetch, options.allowLocalOverride);
      if (!ssrfCheck.isValid) {
        return {
          isExecutionError: true,
          statusCode: null,
          responseTime: Date.now() - startTime,
          responseSize: 0,
          responseHeaders: {},
          rawBody: '',
          parsedBody: null,
          errorMessage: `SSRF Validation Failed: ${ssrfCheck.reason}`,
        };
      }

      const controller = new AbortController();
      const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(targetUrlToFetch, {
          method,
          headers: requestHeaders,
          body: bodyData,
          redirect: 'manual',
          signal: controller.signal,
        });

        clearTimeout(timeoutTimer);

        // Check for redirects (301, 302, 303, 307, 308)
        if (
          [301, 302, 303, 307, 308].includes(response.status) &&
          response.headers.has('location')
        ) {
          redirectCount++;
          if (redirectCount > MAX_REDIRECTS) {
            return {
              isExecutionError: true,
              statusCode: null,
              responseTime: Date.now() - startTime,
              responseSize: 0,
              responseHeaders: {},
              rawBody: '',
              parsedBody: null,
              errorMessage: `Maximum redirect count of ${MAX_REDIRECTS} exceeded`,
            };
          }

          const rawLocation = response.headers.get('location')!;
          const nextTarget = new URL(rawLocation, targetUrlToFetch);
          targetUrlToFetch = nextTarget.toString();
          continue;
        }

        finalResponse = response;
        break;
      } catch (fetchError: any) {
        clearTimeout(timeoutTimer);
        const elapsed = Date.now() - startTime;

        if (fetchError.name === 'AbortError') {
          return {
            isExecutionError: true,
            statusCode: null,
            responseTime: elapsed,
            responseSize: 0,
            responseHeaders: {},
            rawBody: '',
            parsedBody: null,
            errorMessage: `Request timed out after ${timeoutMs}ms`,
          };
        }

        return {
          isExecutionError: true,
          statusCode: null,
          responseTime: elapsed,
          responseSize: 0,
          responseHeaders: {},
          rawBody: '',
          parsedBody: null,
          errorMessage: `Network error: ${fetchError.message || String(fetchError)}`,
        };
      }
    }

    if (!finalResponse) {
      return {
        isExecutionError: true,
        statusCode: null,
        responseTime: Date.now() - startTime,
        responseSize: 0,
        responseHeaders: {},
        rawBody: '',
        parsedBody: null,
        errorMessage: 'Failed to obtain an HTTP response',
      };
    }

    const elapsed = Date.now() - startTime;
    const sanitizedHeaders = sanitizeHeaders(finalResponse.headers);

    // Read response text with size limiter
    let responseText = '';
    let responseSize = 0;

    try {
      const buffer = await finalResponse.arrayBuffer();
      responseSize = buffer.byteLength;

      if (buffer.byteLength > MAX_RESPONSE_BODY_SIZE) {
        const sliced = buffer.slice(0, MAX_RESPONSE_BODY_SIZE);
        responseText = new TextDecoder('utf-8').decode(sliced) + '\n[Response truncated: exceeds 1MB limit]';
      } else {
        responseText = new TextDecoder('utf-8').decode(buffer);
      }
    } catch {
      responseText = '';
    }

    // Parse as JSON if applicable
    let parsedBody: any = null;
    if (responseText) {
      try {
        parsedBody = JSON.parse(responseText);
      } catch {
        parsedBody = responseText;
      }
    }

    return {
      isExecutionError: false,
      statusCode: finalResponse.status,
      responseTime: elapsed,
      responseSize,
      responseHeaders: sanitizedHeaders,
      rawBody: responseText,
      parsedBody,
    };
  } catch (error: any) {
    return {
      isExecutionError: true,
      statusCode: null,
      responseTime: Date.now() - startTime,
      responseSize: 0,
      responseHeaders: {},
      rawBody: '',
      parsedBody: null,
      errorMessage: `Execution error: ${error.message || String(error)}`,
    };
  }
}

