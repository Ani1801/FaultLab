const SENSITIVE_HEADER_KEYS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'x-access-token',
  'x-faultlab-agent-token',
  'session-token',
  'secret',
]);

const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'token',
  'secret',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'api_key',
  'apikey',
  'client_secret',
  'private_key',
  'authorization',
]);

export function redactHeaders(headers?: Record<string, string>): Record<string, string> {
  if (!headers || typeof headers !== 'object') return {};

  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_HEADER_KEYS.has(lowerKey)) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export function redactUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const paramKeys: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      paramKeys.push(key);
    });

    for (const param of paramKeys) {
      const lower = param.toLowerCase();
      if (
        SENSITIVE_FIELD_NAMES.has(lower) ||
        lower.includes('token') ||
        lower.includes('secret') ||
        lower.includes('key') ||
        lower.includes('password')
      ) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export function redactJsonBody(body: unknown, depth = 0): unknown {
  if (depth > 10 || body === null || typeof body !== 'object') {
    return body;
  }

  if (Array.isArray(body)) {
    return body.map((item) => redactJsonBody(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(body as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (
      SENSITIVE_FIELD_NAMES.has(lowerKey) ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      (lowerKey.includes('token') && !lowerKey.includes('count'))
    ) {
      result[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      result[key] = redactJsonBody(val, depth + 1);
    } else {
      result[key] = val;
    }
  }

  return result;
}
