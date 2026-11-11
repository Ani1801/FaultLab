// FaultLab - Phase 8: API Diagnostic Engine Rules
// Deterministic, rule-based classification. No AI, no eval(), no hardcoded messages.
// All findings are dynamically generated from actual execution evidence.
//
// Performance heuristic thresholds (documented explicitly per design spec):
//   > 2000ms and <= 5000ms → INFO  (PERF_003)
//   > 5000ms               → WARNING (PERF_002)
//   > maxResponseTime (user-configured) → HIGH (PERF_001)
//
// Network error classification uses string pattern matching on errorMessage from http.executor.ts.

import type {
  DiagnosticFinding,
  DiagnosticInput,
  DiagnosticCategory,
  DiagnosticSeverity,
} from './diagnostic.types.js';

// ─── Helper ───────────────────────────────────────────────────────────────────

function finding(
  code: string,
  category: DiagnosticCategory,
  severity: DiagnosticSeverity,
  title: string,
  explanation: string,
  evidence: string,
  probableCause: string,
  recommendedActions: string[],
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH'
): DiagnosticFinding {
  return { code, category, severity, title, explanation, evidence, probableCause, recommendedActions, confidence };
}

// ─── Network / Connection Rules ───────────────────────────────────────────────

function runNetworkRules(input: DiagnosticInput): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];
  if (!input.isExecutionError) return findings;

  const err = (input.errorMessage || '').toLowerCase();
  const rawErr = input.errorMessage || 'Unknown error';

  if (err.includes('invalid url') || err.includes('invalid url format')) {
    findings.push(finding(
      'NET_003', 'NETWORK', 'HIGH',
      'Invalid URL Format',
      `The URL provided could not be parsed as a valid HTTP/HTTPS URL. FaultLab cannot issue a request to a malformed address.`,
      `Error: ${rawErr}`,
      'The URL is missing a protocol (http:// or https://), contains illegal characters, or is otherwise malformed.',
      [
        'Verify the URL begins with http:// or https://.',
        'Check for typos, unencoded special characters, or missing host.',
        'Use a URL validator to confirm the format before testing.',
      ]
    ));
  } else if (err.includes('ssrf') || err.includes('prohibited') || err.includes('private') || err.includes('restricted') || err.includes('loopback') || err.includes('blocked')) {
    findings.push(finding(
      'NET_006', 'NETWORK', 'HIGH',
      'SSRF Protection: Target Blocked',
      `FaultLab blocked the outbound request because the target URL resolves to a private, loopback, or otherwise restricted network address. This is a security boundary.`,
      `Error: ${rawErr}`,
      'The URL resolves to a private IP range (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x) or another blocked category.',
      [
        'Use only publicly accessible API endpoints for real API tests.',
        'If you need to test a local server, consider a tunneling service (e.g. ngrok) to expose it publicly.',
        'Review FaultLab\'s SSRF policy in the documentation.',
      ]
    ));
  } else if (err.includes('timeout') || err.includes('timed out')) {
    findings.push(finding(
      'NET_004', 'NETWORK', 'HIGH',
      'Request Timeout: No Response Within Configured Limit',
      `The remote server did not respond within the configured timeout period of ${input.timeoutMs}ms.`,
      `Error: ${rawErr}. Timeout setting: ${input.timeoutMs}ms`,
      'The remote server is overloaded, unreachable, or simply slow to respond. The network path may also have high latency.',
      [
        `Consider increasing the timeout beyond ${input.timeoutMs}ms if the target API is known to be slow.`,
        'Check if the remote API endpoint is currently operational.',
        'Test from a different network to rule out routing issues.',
        'Inspect the remote server\'s logs for signs of overload or unhandled connections.',
      ]
    ));
  } else if (err.includes('econnrefused') || err.includes('connection refused')) {
    findings.push(finding(
      'NET_002', 'NETWORK', 'HIGH',
      'Connection Refused',
      `The target host actively rejected the TCP connection. The server is not listening on the specified port.`,
      `Error: ${rawErr}`,
      'No process is listening on the target port, or a firewall is actively rejecting the connection.',
      [
        'Verify the server is running and listening on the expected port.',
        'Check if the port number in the URL is correct.',
        'Inspect firewall rules that may be blocking inbound connections on that port.',
      ]
    ));
  } else if (err.includes('enotfound') || err.includes('dns') || err.includes('getaddrinfo')) {
    findings.push(finding(
      'NET_001', 'NETWORK', 'HIGH',
      'DNS Resolution Failure',
      `The hostname in the URL could not be resolved to an IP address. The domain may not exist or DNS is unavailable.`,
      `Error: ${rawErr}`,
      'The domain name does not exist, is misspelled, or DNS servers are unreachable from the FaultLab server.',
      [
        'Double-check the hostname for typos.',
        'Confirm the domain is registered and DNS records are configured.',
        'Test the domain in a browser or via `nslookup` to verify DNS resolution.',
      ]
    ));
  } else if (err.includes('cert') || err.includes('certificate') || err.includes('tls') || err.includes('ssl')) {
    findings.push(finding(
      'NET_005', 'NETWORK', 'HIGH',
      'TLS/SSL Certificate Error',
      `The TLS handshake with the remote server failed. The certificate may be expired, self-signed, or for a different domain.`,
      `Error: ${rawErr}`,
      'Common causes: expired certificate, self-signed certificate not trusted by FaultLab, certificate hostname mismatch, or incomplete certificate chain.',
      [
        'Verify the server\'s TLS certificate is valid and not expired.',
        'Ensure the certificate matches the hostname being requested.',
        'If using a self-signed certificate, it must be trusted by the FaultLab server\'s CA store.',
        'Check if the full certificate chain (intermediates) is configured on the server.',
      ]
    ));
  } else if (err.includes('econnreset') || err.includes('connection reset') || err.includes('socket hang up')) {
    findings.push(finding(
      'NET_007', 'NETWORK', 'MEDIUM',
      'Connection Reset by Peer',
      `The remote server abruptly closed the TCP connection while the request was in flight. No HTTP response was received.`,
      `Error: ${rawErr}`,
      'The server may have crashed, been restarted, enforced a connection limit, or a load balancer dropped the connection.',
      [
        'Retry the request to see if it is a transient issue.',
        'Check if the remote API has rate-limiting or connection throttling policies.',
        'Review server-side logs for crashes or connection pool exhaustion.',
      ]
    ));
  } else {
    // Generic network/execution error
    findings.push(finding(
      'NET_008', 'NETWORK', 'HIGH',
      'Network Execution Error',
      `An unclassified network or execution error prevented FaultLab from obtaining an HTTP response from the target server.`,
      `Error: ${rawErr}`,
      'The request failed before any HTTP response was received. This may be due to network routing issues, server unavailability, or an unsupported protocol.',
      [
        'Review the error message for specific details about the failure.',
        'Verify the target URL is correct and the server is reachable.',
        'Check network connectivity and proxy settings if applicable.',
      ]
    ));
  }

  return findings;
}

// ─── HTTP Status Rules ────────────────────────────────────────────────────────

function runHttpStatusRules(input: DiagnosticInput): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];
  if (input.isExecutionError || input.statusCode === null) return findings;

  const status = input.statusCode;
  const urlDisplay = input.url.split('?')[0]; // strip query string for display

  if (status === 400) {
    findings.push(finding(
      'HTTP_400', 'HTTP_STATUS', 'HIGH',
      'Bad Request (400)',
      `The server rejected the request because it was malformed or contained invalid syntax.`,
      `HTTP 400 received for ${input.method} ${urlDisplay}`,
      'The request body, query parameters, or headers do not conform to what the server expects.',
      [
        'Review the request body for JSON syntax errors or missing required fields.',
        'Check query parameter names and value formats against the API documentation.',
        'Verify Content-Type headers match the body format.',
        'Inspect the response body for specific error messages from the server.',
      ]
    ));
  }

  if (status === 401) {
    if (input.authenticationType === 'NONE') {
      findings.push(finding(
        'AUTH_001', 'AUTHENTICATION', 'HIGH',
        'Unauthorized: Missing Authentication Credentials',
        `The server requires authentication but no credentials were provided in this request.`,
        `HTTP 401 received; authentication type configured as NONE`,
        'The endpoint requires authentication (Bearer token, API key, Basic auth) which was not configured in this test.',
        [
          'Configure authentication in the test settings (Bearer Token, API Key, or Basic Auth).',
          'Obtain valid credentials or tokens from the API provider.',
          'Verify the authentication scheme required by the API (check documentation).',
        ]
      ));
    } else {
      findings.push(finding(
        'AUTH_001', 'AUTHENTICATION', 'MEDIUM',
        'Unauthorized: Invalid or Expired Credentials',
        `Authentication was configured but the server rejected the credentials. The token may be expired, revoked, or incorrect.`,
        `HTTP 401 received; authentication type: ${input.authenticationType}`,
        'The provided token, API key, or username/password combination is not accepted by the server.',
        [
          'Verify the credentials in the test configuration are current and correct.',
          'Check if the token has expired and generate a new one.',
          'Ensure the correct authentication scheme is selected (e.g., Bearer vs. API Key).',
          'Confirm the credentials have the required permissions for this endpoint.',
        ]
      ));
    }
  }

  if (status === 403) {
    findings.push(finding(
      'AUTH_002', 'AUTHENTICATION', 'HIGH',
      'Forbidden: Insufficient Permissions',
      `The server recognized the credentials but the authenticated identity does not have permission to access this resource.`,
      `HTTP 403 received for ${input.method} ${urlDisplay}`,
      'The authenticated user or API key lacks the required role, scope, or permission for this operation.',
      [
        'Verify the account or API key has the correct permissions/scopes for this endpoint.',
        'Check the API documentation for required roles or access levels.',
        'Contact the API provider\'s administrator to grant the necessary access.',
        'Ensure you are not trying to access another user\'s resource without authorization.',
      ]
    ));
  }

  if (status === 404) {
    findings.push(finding(
      'HTTP_404', 'HTTP_STATUS', 'HIGH',
      'Not Found (404)',
      `The requested resource was not found on the server. The URL path may be incorrect or the resource may have been deleted.`,
      `HTTP 404 received for ${input.method} ${urlDisplay}`,
      'The URL path is incorrect, the resource ID does not exist, or the API version has changed.',
      [
        'Verify the URL path is correct, including any path parameters (e.g., resource IDs).',
        'Check the API documentation for the correct endpoint path.',
        'Confirm the resource exists (e.g., by listing resources first).',
        'Verify the API base URL and version prefix.',
      ]
    ));
  }

  if (status === 405) {
    findings.push(finding(
      'REQ_001', 'REQUEST_CONFIG', 'HIGH',
      'Method Not Allowed (405)',
      `The HTTP method used is not supported for this endpoint.`,
      `HTTP 405 received for ${input.method} ${urlDisplay}`,
      'The API endpoint exists but does not accept the specified HTTP method.',
      [
        `Verify that ${input.method} is the correct HTTP method for this operation.`,
        'Check the response\'s Allow header to see which methods are supported.',
        'Review the API documentation for the correct method for this endpoint.',
      ]
    ));
  }

  if (status === 408) {
    findings.push(finding(
      'HTTP_408', 'HTTP_STATUS', 'MEDIUM',
      'Request Timeout (408)',
      `The server timed out waiting for the client to send the complete request.`,
      `HTTP 408 received for ${input.method} ${urlDisplay}`,
      'The request (especially the body upload) took too long to reach the server.',
      [
        'Check network latency between FaultLab and the target server.',
        'If uploading a large body, consider compressing it or splitting the request.',
        'Verify there are no proxy or firewall timeout policies interfering.',
      ]
    ));
  }

  if (status === 409) {
    findings.push(finding(
      'HTTP_409', 'HTTP_STATUS', 'MEDIUM',
      'Conflict (409)',
      `The request conflicts with the current state of the resource.`,
      `HTTP 409 received for ${input.method} ${urlDisplay}`,
      'A resource with the same unique identifier already exists, or a concurrent modification conflict occurred.',
      [
        'Check if you are trying to create a resource that already exists.',
        'Review if another operation is concurrently modifying the same resource.',
        'Consider using PUT instead of POST if you want to update an existing resource.',
      ]
    ));
  }

  if (status === 422) {
    findings.push(finding(
      'HTTP_422', 'HTTP_STATUS', 'HIGH',
      'Unprocessable Entity (422)',
      `The request was well-formed but contained semantic validation errors.`,
      `HTTP 422 received for ${input.method} ${urlDisplay}`,
      'The request body has the correct syntax but fails business logic validation on the server.',
      [
        'Read the response body carefully — it typically contains detailed validation error messages.',
        'Ensure all required fields are present and have correct data types.',
        'Verify enum values, string lengths, number ranges, and date formats match the schema.',
      ]
    ));
    findings.push(finding(
      'REQ_002', 'REQUEST_CONFIG', 'MEDIUM',
      'Request Validation Errors Detected',
      `The server reported semantic validation failures. The request structure may not match the API\'s expected schema.`,
      `HTTP 422 received with validation errors`,
      'Request body fields are missing, have incorrect types, or violate business rules.',
      [
        'Compare your request body against the API documentation schema.',
        'Check for required fields, correct data types, and valid enumeration values.',
        'Inspect the response body for field-specific error messages.',
      ],
      'MEDIUM'
    ));
  }

  if (status === 429) {
    findings.push(finding(
      'HTTP_429', 'HTTP_STATUS', 'MEDIUM',
      'Too Many Requests (429): Rate Limit Exceeded',
      `The client has sent too many requests in a given time window and the server is throttling the connection.`,
      `HTTP 429 received for ${input.method} ${urlDisplay}`,
      'The API has a rate-limiting policy that the current request frequency has exceeded.',
      [
        'Respect Retry-After headers in the response if present.',
        'Implement exponential backoff between requests.',
        'Review the API documentation for the rate limit policy (requests per minute/hour).',
        'Consider caching responses to reduce redundant API calls.',
      ]
    ));
  }

  if (status === 500) {
    findings.push(finding(
      'HTTP_500', 'HTTP_STATUS', 'HIGH',
      'Internal Server Error (500)',
      `The remote server encountered an unexpected condition and could not fulfill the request.`,
      `HTTP 500 received for ${input.method} ${urlDisplay}`,
      'The API server has a bug, unhandled exception, or is in a degraded state.',
      [
        'This is a server-side issue — verify the API endpoint is functioning correctly.',
        'Check the API provider\'s status page for incidents.',
        'Review the response body for server-provided error details.',
        'Retry the request to determine if it is intermittent.',
      ]
    ));
  }

  if (status === 502) {
    findings.push(finding(
      'HTTP_502', 'HTTP_STATUS', 'HIGH',
      'Bad Gateway (502)',
      `A proxy or gateway server received an invalid response from the upstream API server.`,
      `HTTP 502 received for ${input.method} ${urlDisplay}`,
      'The upstream server (behind a load balancer or API gateway) is down or returning malformed responses.',
      [
        'Check the API provider\'s status page for infrastructure incidents.',
        'Retry the request after a short delay.',
        'Verify the API base URL is correct and not pointing to a misconfigured proxy.',
      ]
    ));
  }

  if (status === 503) {
    findings.push(finding(
      'HTTP_503', 'HTTP_STATUS', 'HIGH',
      'Service Unavailable (503)',
      `The server is temporarily unable to handle requests due to overload or maintenance.`,
      `HTTP 503 received for ${input.method} ${urlDisplay}`,
      'The API server is overloaded, undergoing maintenance, or experiencing a failure.',
      [
        'Check the API provider\'s status page or maintenance schedule.',
        'Implement retry logic with exponential backoff in your application.',
        'Respect Retry-After headers if present in the response.',
      ]
    ));
  }

  if (status === 504) {
    findings.push(finding(
      'HTTP_504', 'HTTP_STATUS', 'HIGH',
      'Gateway Timeout (504)',
      `A gateway or proxy server timed out waiting for the upstream API server to respond.`,
      `HTTP 504 received for ${input.method} ${urlDisplay}`,
      'The upstream API server is too slow or unresponsive. The gateway gave up waiting.',
      [
        'The issue is on the server side — check the API provider\'s status page.',
        'Consider increasing request timeout in your FaultLab test configuration.',
        'If this occurs repeatedly, the API server may be overloaded.',
      ]
    ));
  }

  return findings;
}

// ─── Authentication Rules ─────────────────────────────────────────────────────

function runAuthRules(input: DiagnosticInput): DiagnosticFinding[] {
  // Most auth findings are already emitted by HTTP status rules.
  // This catches additional misconfigurations.
  const findings: DiagnosticFinding[] = [];
  if (input.isExecutionError) return findings;

  // Warn about Basic auth over non-HTTPS
  if (
    input.authenticationType === 'BASIC' &&
    input.url.toLowerCase().startsWith('http://') &&
    input.statusCode !== null
  ) {
    findings.push(finding(
      'AUTH_003', 'AUTHENTICATION', 'HIGH',
      'Basic Auth Credentials Transmitted Over Insecure HTTP',
      `Basic authentication encodes credentials in Base64, which is NOT encryption. Sending over HTTP exposes them in plaintext.`,
      `Authentication type: BASIC; URL scheme: HTTP (not HTTPS)`,
      'HTTP does not encrypt traffic; Basic auth credentials can be intercepted by anyone on the network path.',
      [
        'Migrate to HTTPS to ensure credentials are encrypted in transit.',
        'Consider using a more secure authentication method (Bearer token, API key).',
        'Never use Basic auth over HTTP in production environments.',
      ]
    ));
  }

  return findings;
}

// ─── Response Rules ───────────────────────────────────────────────────────────

function runResponseRules(input: DiagnosticInput): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];
  if (input.isExecutionError || input.statusCode === null) return findings;

  const contentType = (input.responseHeaders['content-type'] || input.responseHeaders['Content-Type'] || '').toLowerCase();
  const hasBody = input.sanitizedResponseBody && input.sanitizedResponseBody.trim().length > 0;
  const status = input.statusCode;

  // JSON Content-Type but body is not valid JSON
  if (contentType.includes('application/json') && hasBody) {
    try {
      JSON.parse(input.sanitizedResponseBody!);
    } catch {
      findings.push(finding(
        'RESP_001', 'RESPONSE', 'MEDIUM',
        'Response Claims JSON but Body is Not Valid JSON',
        `The response Content-Type is application/json but the body cannot be parsed as valid JSON.`,
        `Content-Type: ${contentType}; body starts with: ${(input.sanitizedResponseBody || '').slice(0, 100)}`,
        'The server may be returning an error page (HTML) with an incorrect Content-Type, or the JSON is malformed.',
        [
          'Inspect the raw response body for HTML error pages or truncated JSON.',
          'Report the content-type mismatch to the API provider.',
          'Check if authentication or routing issues cause an error page to be served.',
        ],
        'HIGH'
      ));
    }
  }

  // Empty body on success (not 204/205/304)
  if (
    !hasBody &&
    status >= 200 && status < 300 &&
    status !== 204 && status !== 205 && status !== 304
  ) {
    findings.push(finding(
      'RESP_002', 'RESPONSE', 'LOW',
      'Empty Response Body on Success',
      `The server returned a ${status} success status but no response body.`,
      `HTTP ${status}; body is empty`,
      'The endpoint may intentionally return empty responses, or the response was not properly serialized.',
      [
        'Verify the API documentation to confirm whether this endpoint always returns an empty body.',
        'If you expected a response body, check the endpoint path and method.',
        'Consider whether a different HTTP method or path is needed.',
      ],
      'LOW'
    ));
  }

  return findings;
}

// ─── Performance Rules ────────────────────────────────────────────────────────

function runPerformanceRules(input: DiagnosticInput): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];
  if (input.isExecutionError) return findings;

  const rt = input.responseTime;

  // User-configured latency threshold violation (from assertion.engine — assertion finding covers FAIL,
  // but we also emit a performance finding for context)
  if (input.maxResponseTime !== null && input.maxResponseTime > 0 && rt > input.maxResponseTime) {
    findings.push(finding(
      'PERF_001', 'PERFORMANCE', 'HIGH',
      'Response Time Exceeds Configured Threshold',
      `The API responded in ${rt}ms, which exceeds your configured maximum latency threshold of ${input.maxResponseTime}ms.`,
      `Response time: ${rt}ms; threshold: ${input.maxResponseTime}ms (${Math.round((rt / input.maxResponseTime) * 100)}% of threshold)`,
      'The remote API is responding slowly. This may be due to server load, network latency, or a heavy query.',
      [
        `Investigate why the API is taking longer than ${input.maxResponseTime}ms.`,
        'Check the API provider\'s status page for performance degradation.',
        'Consider caching frequently requested data to reduce latency.',
        'If the threshold is too strict, adjust it in the test configuration.',
      ]
    ));
  }

  // Heuristic: > 5000ms is very slow (WARNING) — documented threshold
  if (rt > 5000 && (input.maxResponseTime === null || input.maxResponseTime <= 5000)) {
    findings.push(finding(
      'PERF_002', 'PERFORMANCE', 'MEDIUM',
      'High Response Latency Detected (>5s)',
      `The API responded in ${rt}ms, which exceeds the 5-second heuristic threshold for acceptable latency.`,
      `Response time: ${rt}ms (heuristic threshold: 5000ms)`,
      'The remote API is responding very slowly. This is a heuristic warning — no user-defined threshold was exceeded.',
      [
        'Monitor this endpoint over multiple runs to establish a baseline.',
        'Investigate server-side performance or database query latency on the API provider side.',
        'Consider setting an explicit maximum response time threshold in the test configuration.',
      ],
      'MEDIUM'
    ));
  } else if (rt > 2000 && rt <= 5000 && (input.maxResponseTime === null || input.maxResponseTime > 2000)) {
    // Heuristic: > 2000ms and <= 5000ms is noticeable (INFO) — documented threshold
    findings.push(finding(
      'PERF_003', 'PERFORMANCE', 'LOW',
      'Moderate Response Latency (>2s)',
      `The API responded in ${rt}ms, which exceeds the 2-second heuristic threshold for optimal performance.`,
      `Response time: ${rt}ms (heuristic threshold: 2000ms)`,
      'The API response time is higher than ideal but within acceptable limits. This is an informational observation.',
      [
        'Monitor latency trends across multiple test runs.',
        'Consider whether response caching could reduce latency for your use case.',
        'If latency consistently exceeds 2s, investigate server-side query performance.',
      ],
      'LOW'
    ));
  }

  return findings;
}

// ─── Assertion Rules ──────────────────────────────────────────────────────────

function runAssertionRules(input: DiagnosticInput): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];

  for (const result of input.assertionResults) {
    if (result.passed) continue;

    if (result.type === 'STATUS_CODE') {
      findings.push(finding(
        'ASSERT_STATUS', 'ASSERTION', 'HIGH',
        `Assertion Failed: ${result.name}`,
        `The HTTP status code assertion failed. The server returned a different status than expected.`,
        result.message || `Expected: ${result.expected}, Actual: ${result.actual}`,
        'The API returned a status code different from what was configured as the expected value.',
        [
          `Review why the API returned ${result.actual} instead of ${result.expected}.`,
          'Check if the endpoint path and method are correct.',
          'If the expectation is wrong, update the expected status code in the test configuration.',
        ]
      ));
    } else if (result.type === 'RESPONSE_TIME') {
      findings.push(finding(
        'ASSERT_LATENCY', 'ASSERTION', 'HIGH',
        `Assertion Failed: ${result.name}`,
        `The response latency assertion failed. The API was slower than the configured maximum.`,
        result.message || `Expected: ${result.expected}, Actual: ${result.actual}`,
        'The API response time exceeded the user-configured maximum latency threshold.',
        [
          'Investigate the cause of high latency on the remote API.',
          'Consider increasing the threshold if the current setting is too strict.',
          'Monitor over multiple runs to determine if this is a consistent issue.',
        ]
      ));
    } else if (result.type === 'JSON_BODY') {
      findings.push(finding(
        'ASSERT_JSON', 'ASSERTION', 'MEDIUM',
        `Assertion Failed: ${result.name}`,
        `A JSON body assertion failed. The response body did not match the expected condition.`,
        result.message || `Expected: ${JSON.stringify(result.expected)}, Actual: ${JSON.stringify(result.actual)}`,
        'The response body structure or values differ from what was asserted.',
        [
          'Inspect the full response body to understand the actual structure.',
          'Verify the JSON path expression is correct (dots for object keys, [0] for arrays).',
          'Check if the API changed its response schema.',
          'Update the assertion if the new response structure is correct behavior.',
        ],
        'MEDIUM'
      ));
    }
  }

  return findings;
}

// ─── Main Rule Runner ─────────────────────────────────────────────────────────

export function runAllRules(input: DiagnosticInput): DiagnosticFinding[] {
  const allFindings: DiagnosticFinding[] = [
    ...runNetworkRules(input),
    ...runHttpStatusRules(input),
    ...runAuthRules(input),
    ...runResponseRules(input),
    ...runPerformanceRules(input),
    ...runAssertionRules(input),
  ];

  // Deduplicate by code (keep first occurrence — most specific)
  const seen = new Set<string>();
  const unique = allFindings.filter((f) => {
    if (seen.has(f.code)) return false;
    seen.add(f.code);
    return true;
  });

  return unique;
}

