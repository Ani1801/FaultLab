export type AssertionOperator =
  | 'EXISTS'
  | 'NOT_EXISTS'
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'CONTAINS';

export interface JsonAssertionConfig {
  field: string;
  operator: AssertionOperator;
  value?: any;
  expectedValue?: any;
}

export interface AssertionResultItem {
  name: string;
  type: 'STATUS_CODE' | 'RESPONSE_TIME' | 'JSON_BODY';
  expected: any;
  actual: any;
  passed: boolean;
  message?: string;
}

export interface EvaluationInput {
  actualStatusCode: number | null;
  actualResponseTime: number;
  responseBody: any;
  expectedStatusCode?: number | null;
  maxResponseTime?: number | null;
  jsonAssertions?: JsonAssertionConfig[] | null;
  isExecutionError?: boolean;
}

export interface EvaluationResult {
  status: 'PASSED' | 'FAILED' | 'ERROR';
  assertionResults: AssertionResultItem[];
  allPassed: boolean;
}

const BLOCKED_PROPERTIES = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Parses a JSON path or JSONPath expression into property/index segments.
 * Supports:
 * - Root identifier: "$", "", or leading "$." / "$[0]"
 * - Dot notation: "data.user.id"
 * - Bracket notation with numbers or quotes: "items[0].name", "data['user-id']", "data[\"user-id\"]"
 * - Root array index: "$[0].id" or "[0].id"
 * Strictly avoids eval() or dynamic code execution.
 */
export function parsePathSegments(rawPath: string): string[] {
  if (!rawPath || typeof rawPath !== 'string') {
    return [];
  }

  let path = rawPath.trim();
  if (path === '$' || path === '') {
    return [];
  }

  // Handle standard JSONPath prefixes
  if (path.startsWith('$.')) {
    path = path.slice(2);
  } else if (path.startsWith('$[')) {
    path = path.slice(1);
  } else if (path.startsWith('$')) {
    path = path.slice(1);
    if (path.startsWith('.')) {
      path = path.slice(1);
    }
  }

  if (path === '') {
    return [];
  }

  const segments: string[] = [];
  let i = 0;
  const len = path.length;

  while (i < len) {
    if (path[i] === '.') {
      i++;
      continue;
    }

    if (path[i] === '[') {
      const closeBracket = path.indexOf(']', i);
      if (closeBracket === -1) {
        const rem = path.slice(i + 1).trim();
        if (rem) segments.push(rem);
        break;
      }
      let inner = path.slice(i + 1, closeBracket).trim();
      // Strip outer quotes if any: 'key' or "key"
      if (
        (inner.startsWith("'") && inner.endsWith("'") && inner.length >= 2) ||
        (inner.startsWith('"') && inner.endsWith('"') && inner.length >= 2)
      ) {
        inner = inner.slice(1, -1);
      }
      if (inner.length > 0) {
        segments.push(inner);
      }
      i = closeBracket + 1;
      continue;
    }

    let nextDot = path.indexOf('.', i);
    let nextBracket = path.indexOf('[', i);
    let nextEnd = len;
    if (nextDot !== -1 && nextBracket !== -1) {
      nextEnd = Math.min(nextDot, nextBracket);
    } else if (nextDot !== -1) {
      nextEnd = nextDot;
    } else if (nextBracket !== -1) {
      nextEnd = nextBracket;
    }

    const segment = path.slice(i, nextEnd).trim();
    if (segment.length > 0) {
      segments.push(segment);
    }
    i = nextEnd;
  }

  return segments;
}

/**
 * Safely extracts a value from a nested JSON structure using dot or bracket notation.
 * Handles:
 * - Leading "$." (JSONPath root): e.g. "$.id", "$.userId", "$.title"
 * - Root reference "$": returns entire response body
 * - Dot and bracket notation: "data.user.id", "items[0].name", "$[0].id"
 * - Serialized JSON string input: safely parses if JSON format
 * - Missing paths or null targets: returns undefined safely without throwing
 * Strictly avoids eval() or dynamic code execution.
 */
export function getNestedValue(obj: any, path: string): any {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  // If obj is a string, check if it is serialized JSON
  let root = obj;
  if (typeof root === 'string') {
    const trimmed = root.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        root = JSON.parse(trimmed);
      } catch {
        // Leave as string if parsing fails
      }
    }
  }

  const segments = parsePathSegments(path);

  // If no segments (e.g. path was "$" or ""), return the root itself
  if (segments.length === 0) {
    return root;
  }

  // If root is still a primitive (e.g. plain text response), we cannot navigate properties
  if (typeof root !== 'object' || root === null) {
    return undefined;
  }

  let current = root;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Prototype pollution defense
    if (BLOCKED_PROPERTIES.has(segment)) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const idx = Number(segment);
      if (Number.isInteger(idx) && idx >= 0 && idx < current.length) {
        current = current[idx];
      } else {
        return undefined;
      }
    } else if (typeof current === 'object') {
      if (Object.prototype.hasOwnProperty.call(current, segment) || segment in current) {
        current = current[segment];
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Safely converts value to a finite number, returning null for non-numeric types
 * (such as null, undefined, boolean, objects, arrays, or empty strings).
 */
export function toNumeric(val: any): number | null {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

/**
 * Compares two values for deep, primitive, or type-coerced equality.
 * Supports:
 * - Primitive strict equality
 * - Number vs numeric string: 1 vs "1"
 * - Boolean vs boolean string: true vs "true"
 * - Null vs "null" string
 * - Stringified JSON vs parsed object/array
 * - Deep object / array equality
 */
export function isEqual(actual: any, expected: any): boolean {
  if (actual === expected) return true;

  // Handle null / "null" string equivalence
  if (actual === null && typeof expected === 'string' && expected.trim().toLowerCase() === 'null') {
    return true;
  }
  if (expected === null && typeof actual === 'string' && actual.trim().toLowerCase() === 'null') {
    return true;
  }

  // Handle boolean / boolean string equivalence ("true" vs true, "false" vs false)
  if (typeof actual === 'boolean' && typeof expected === 'string') {
    const expLower = expected.trim().toLowerCase();
    if (expLower === 'true' && actual === true) return true;
    if (expLower === 'false' && actual === false) return true;
  }
  if (typeof expected === 'boolean' && typeof actual === 'string') {
    const actLower = actual.trim().toLowerCase();
    if (actLower === 'true' && expected === true) return true;
    if (actLower === 'false' && expected === false) return true;
  }

  // Handle numeric string vs number (e.g. 1 vs "1")
  const numActual = toNumeric(actual);
  const numExpected = toNumeric(expected);
  if (
    numActual !== null &&
    numExpected !== null &&
    (typeof actual === 'number' || typeof expected === 'number')
  ) {
    return numActual === numExpected;
  }

  // Handle stringified JSON vs object/array
  if (typeof actual === 'object' && actual !== null && typeof expected === 'string') {
    try {
      const parsed = JSON.parse(expected);
      return JSON.stringify(actual) === JSON.stringify(parsed);
    } catch {
      // Not JSON
    }
  }
  if (typeof expected === 'object' && expected !== null && typeof actual === 'string') {
    try {
      const parsed = JSON.parse(actual);
      return JSON.stringify(parsed) === JSON.stringify(expected);
    } catch {
      // Not JSON
    }
  }

  // Handle deep object / array equality
  if (
    typeof actual === 'object' &&
    typeof expected === 'object' &&
    actual !== null &&
    expected !== null
  ) {
    try {
      return JSON.stringify(actual) === JSON.stringify(expected);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Evaluates a single JSON path assertion against the response body.
 */
export function evaluateJsonAssertion(
  assertion: JsonAssertionConfig,
  responseBody: any
): AssertionResultItem {
  const fieldPath = (assertion.field || '').trim();
  const actualValue = getNestedValue(responseBody, fieldPath);
  const operator = assertion.operator;
  const expectedValue =
    assertion.value !== undefined ? assertion.value : assertion.expectedValue;

  let passed = false;
  let message: string | undefined;

  switch (operator) {
    case 'EXISTS': {
      passed = actualValue !== undefined;
      message = passed
        ? `Field "${fieldPath}" exists`
        : `Field "${fieldPath}" does not exist in response`;
      break;
    }

    case 'NOT_EXISTS': {
      passed = actualValue === undefined;
      message = passed
        ? `Field "${fieldPath}" does not exist`
        : `Field "${fieldPath}" unexpectedly exists`;
      break;
    }

    case 'EQUALS': {
      passed = isEqual(actualValue, expectedValue);
      const actualStr = actualValue !== undefined ? JSON.stringify(actualValue) : 'undefined';
      message = passed
        ? `Field "${fieldPath}" equals expected value`
        : `Expected "${fieldPath}" to equal ${JSON.stringify(expectedValue)}, but received ${actualStr}`;
      break;
    }

    case 'NOT_EQUALS': {
      passed = !isEqual(actualValue, expectedValue);
      const actualStr = actualValue !== undefined ? JSON.stringify(actualValue) : 'undefined';
      message = passed
        ? `Field "${fieldPath}" does not equal specified value`
        : `Expected "${fieldPath}" not to equal ${JSON.stringify(expectedValue)}, but received ${actualStr}`;
      break;
    }

    case 'GREATER_THAN': {
      const numActual = toNumeric(actualValue);
      const numExpected = toNumeric(expectedValue);
      passed = numActual !== null && numExpected !== null && numActual > numExpected;
      const actualStr = actualValue !== undefined ? actualValue : 'undefined';
      message = passed
        ? `Field "${fieldPath}" (${numActual}) is greater than ${numExpected}`
        : `Expected "${fieldPath}" (${actualStr}) to be greater than ${expectedValue}`;
      break;
    }

    case 'LESS_THAN': {
      const numActual = toNumeric(actualValue);
      const numExpected = toNumeric(expectedValue);
      passed = numActual !== null && numExpected !== null && numActual < numExpected;
      const actualStr = actualValue !== undefined ? actualValue : 'undefined';
      message = passed
        ? `Field "${fieldPath}" (${numActual}) is less than ${numExpected}`
        : `Expected "${fieldPath}" (${actualStr}) to be less than ${expectedValue}`;
      break;
    }

    case 'CONTAINS': {
      if (typeof actualValue === 'string') {
        const needle = expectedValue !== undefined && expectedValue !== null ? String(expectedValue) : '';
        passed = actualValue.includes(needle);
        message = passed
          ? `Field "${fieldPath}" contains substring "${expectedValue}"`
          : `Field "${fieldPath}" does not contain "${expectedValue}"`;
      } else if (Array.isArray(actualValue)) {
        passed = actualValue.some((item) => isEqual(item, expectedValue));
        message = passed
          ? `Array "${fieldPath}" contains specified element`
          : `Array "${fieldPath}" does not contain expected item`;
      } else {
        passed = false;
        message = `Field "${fieldPath}" is neither a string nor an array`;
      }
      break;
    }

    default: {
      passed = false;
      message = `Unknown assertion operator: "${operator}"`;
      break;
    }
  }

  return {
    name: `JSON Body: ${fieldPath} ${operator}`,
    type: 'JSON_BODY',
    expected: expectedValue !== undefined ? expectedValue : operator,
    actual: actualValue !== undefined ? actualValue : null,
    passed,
    message,
  };
}

/**
 * Evaluates all configured assertions (status code, max response time, JSON body paths).
 */
export function evaluateTestAssertions(input: EvaluationInput): EvaluationResult {
  if (input.isExecutionError) {
    return {
      status: 'ERROR',
      assertionResults: [],
      allPassed: false,
    };
  }

  const results: AssertionResultItem[] = [];

  // 1. Status Code Assertion
  if (input.expectedStatusCode !== undefined && input.expectedStatusCode !== null) {
    const passed = input.actualStatusCode === input.expectedStatusCode;
    results.push({
      name: 'HTTP Status Code',
      type: 'STATUS_CODE',
      expected: input.expectedStatusCode,
      actual: input.actualStatusCode,
      passed,
      message: passed
        ? `Received expected HTTP status ${input.actualStatusCode}`
        : `Expected status ${input.expectedStatusCode}, but received ${input.actualStatusCode}`,
    });
  }

  // 2. Response Time (Latency) Assertion
  if (input.maxResponseTime !== undefined && input.maxResponseTime !== null && input.maxResponseTime > 0) {
    const passed = input.actualResponseTime <= input.maxResponseTime;
    results.push({
      name: 'Response Latency Threshold',
      type: 'RESPONSE_TIME',
      expected: `<=${input.maxResponseTime}ms`,
      actual: `${input.actualResponseTime}ms`,
      passed,
      message: passed
        ? `Response time of ${input.actualResponseTime}ms is within the allowed threshold of ${input.maxResponseTime}ms`
        : `Response time of ${input.actualResponseTime}ms exceeded maximum allowed threshold of ${input.maxResponseTime}ms`,
    });
  }

  // 3. JSON Body Assertions
  if (input.jsonAssertions && Array.isArray(input.jsonAssertions)) {
    // If responseBody is a serialized JSON string, parse it safely
    let parsedBody = input.responseBody;
    if (typeof parsedBody === 'string') {
      const trimmed = parsedBody.trim();
      if (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
      ) {
        try {
          parsedBody = JSON.parse(trimmed);
        } catch {
          // Leave as string
        }
      }
    }

    for (const assertion of input.jsonAssertions) {
      if (assertion.field && assertion.operator) {
        results.push(evaluateJsonAssertion(assertion, parsedBody));
      }
    }
  }

  const allPassed = results.length === 0 || results.every((r) => r.passed);
  const status: 'PASSED' | 'FAILED' = allPassed ? 'PASSED' : 'FAILED';

  return {
    status,
    assertionResults: results,
    allPassed,
  };
}
