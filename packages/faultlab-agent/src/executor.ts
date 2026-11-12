import { performance } from 'perf_hooks';
import { AgentTaskPayload, AgentExecutionResult } from './types';
import { redactHeaders, redactUrl } from './redactor';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_TIMEOUT_MS = 30000; // 30 seconds

export class SecurityOriginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityOriginError';
  }
}

/**
 * Validates that the target URL matches the configured approved origin.
 */
export function validateTargetOrigin(targetUrl: string, approvedOrigin: string): URL {
  let target: URL;
  try {
    target = new URL(targetUrl);
  } catch {
    throw new SecurityOriginError(`Invalid target URL: ${targetUrl}`);
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new SecurityOriginError(`Forbidden protocol: ${target.protocol}. Only http and https are permitted.`);
  }

  let approved: URL;
  try {
    approved = new URL(approvedOrigin);
  } catch {
    throw new SecurityOriginError(`Invalid approved origin configuration: ${approvedOrigin}`);
  }

  // Strict origin check: protocol, hostname, and port must match
  // Also normalize localhost and 127.0.0.1 if both target local loopback
  const isApprovedLoopback = approved.hostname === 'localhost' || approved.hostname === '127.0.0.1';
  const isTargetLoopback = target.hostname === 'localhost' || target.hostname === '127.0.0.1';

  const approvedPort = approved.port || (approved.protocol === 'https:' ? '443' : '80');
  const targetPort = target.port || (target.protocol === 'https:' ? '443' : '80');

  let originMatches = false;
  if (isApprovedLoopback && isTargetLoopback) {
    originMatches = approved.protocol === target.protocol && approvedPort === targetPort;
  } else {
    originMatches = target.origin.toLowerCase() === approved.origin.toLowerCase();
  }

  if (!originMatches) {
    throw new SecurityOriginError(
      `Execution blocked: Target URL "${target.origin}" does not match approved local origin "${approved.origin}".`
    );
  }

  // Block cloud metadata or link-local ranges explicitly
  const forbiddenHosts = ['169.254.169.254', 'metadata.google.internal', 'metadata.aws.internal', 'instance-data'];
  if (forbiddenHosts.includes(target.hostname.toLowerCase())) {
    throw new SecurityOriginError(`Execution blocked: Target host "${target.hostname}" is forbidden.`);
  }

  return target;
}

/**
 * Executes a task against the local approved origin.
 */
export async function executeLocalTask(
  payload: AgentTaskPayload,
  approvedOrigin: string
): Promise<AgentExecutionResult> {
  const startTime = performance.now();
  let validatedUrl: URL;

  try {
    validatedUrl = validateTargetOrigin(payload.url, approvedOrigin);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const elapsed = Math.round(performance.now() - startTime);
    return {
      statusCode: 0,
      statusText: 'ORIGIN_FORBIDDEN',
      responseTime: elapsed,
      responseSize: 0,
      responseHeaders: {},
      rawBody: '',
      isExecutionError: true,
      errorMessage: errorMsg,
      errorCode: 'ERR_SECURITY_ORIGIN_MISMATCH',
      evidence: {
        targetUrl: redactUrl(payload.url),
        localOrigin: approvedOrigin,
        redirectCount: 0,
      },
    };
  }

  // Append query params if provided
  if (payload.queryParams && Object.keys(payload.queryParams).length > 0) {
    for (const [k, v] of Object.entries(payload.queryParams)) {
      if (v !== undefined && v !== null) {
        validatedUrl.searchParams.set(k, String(v));
      }
    }
  }

  const timeoutMs = Math.min(payload.timeoutMs || 10000, MAX_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const requestHeaders: Record<string, string> = { ...(payload.headers || {}) };
  let requestBody: string | undefined = undefined;

  if (payload.body !== undefined && payload.body !== null && payload.method.toUpperCase() !== 'GET' && payload.method.toUpperCase() !== 'HEAD') {
    if (typeof payload.body === 'string') {
      requestBody = payload.body;
    } else {
      requestBody = JSON.stringify(payload.body);
      if (!requestHeaders['content-type'] && !requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json';
      }
    }
  }

  try {
    const response = await fetch(validatedUrl.toString(), {
      method: payload.method.toUpperCase(),
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
      redirect: 'manual', // do not follow redirects blindly
    });

    clearTimeout(timeoutId);
    const elapsed = Math.round(performance.now() - startTime);

    // Read response body with byte limit
    const arrayBuffer = await response.arrayBuffer();
    const responseSize = arrayBuffer.byteLength;
    const truncatedBuffer = arrayBuffer.slice(0, MAX_RESPONSE_BYTES);
    const decoder = new TextDecoder('utf-8');
    const rawBody = decoder.decode(truncatedBuffer);

    let parsedBody: unknown = undefined;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        // Keep as raw string if JSON parsing fails
      }
    }

    // Convert response headers
    const rawHeaders: Record<string, string> = {};
    response.headers.forEach((val: string, key: string) => {
      rawHeaders[key] = val;
    });

    return {
      statusCode: response.status,
      statusText: response.statusText || String(response.status),
      responseTime: elapsed,
      responseSize,
      responseHeaders: redactHeaders(rawHeaders),
      rawBody,
      parsedBody,
      isExecutionError: false,
      evidence: {
        targetUrl: redactUrl(validatedUrl.toString()),
        localOrigin: approvedOrigin,
        redirectCount: 0,
      },
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const elapsed = Math.round(performance.now() - startTime);
    const errorObj = err as { name?: string; message?: string; code?: string; cause?: { code?: string; message?: string } };

    const isTimeout = errorObj.name === 'AbortError' || errorObj.message?.includes('aborted');
    const rawCode = errorObj.cause?.code || errorObj.code || (isTimeout ? 'ETIMEDOUT' : 'ERR_NETWORK');
    const causeMsg = errorObj.cause?.message || '';
    const errorMsg = isTimeout
      ? `Request timed out after ${timeoutMs}ms`
      : `${errorObj.message || 'Connection failed'}: ${rawCode} ${causeMsg}`.trim();

    return {
      statusCode: 0,
      statusText: isTimeout ? 'TIMEOUT' : 'CONNECTION_ERROR',
      responseTime: elapsed,
      responseSize: 0,
      responseHeaders: {},
      rawBody: '',
      isExecutionError: true,
      errorMessage: errorMsg,
      errorCode: String(rawCode),
      evidence: {
        targetUrl: redactUrl(validatedUrl.toString()),
        localOrigin: approvedOrigin,
        redirectCount: 0,
      },
    };
  }
}
