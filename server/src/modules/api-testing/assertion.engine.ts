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

/**
 * Safely extracts a value from a nested JSON object using dot or bracket notation.
 * Example paths: "message", "data.user.id", "items[0].name", "rates.USD".
 * Strictly avoids eval() or dynamic code execution.
 */
export function getNestedValue(obj: any, path: string): any {
  if (obj === null || obj === undefined || !path) {
    return undefined;
  }

  // Normalize path segments (e.g. "users[0].name" -> ["users", "0", "name"])
  const normalizedPath = path
    .replace(/\[(\w+)\]/g, '.$1')
    .replace(/^\./, '');
  const segments = normalizedPath.split('.');

  let current = obj;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

/**
 * Compares two values for deep or primitive equality.
 */
function isEqual(actual: any, expected: any): boolean {
  if (actual === expected) return true;

  // Handle numeric string vs number
  if (typeof actual === 'number' && typeof expected === 'string') {
    const parsed = Number(expected);
    if (!isNaN(parsed) && actual === parsed) return true;
  }
  if (typeof actual === 'string' && typeof expected === 'number') {
    const parsed = Number(actual);
    if (!isNaN(parsed) && parsed === expected) return true;
  }

  // Handle object / array JSON equality
  if (typeof actual === 'object' && typeof expected === 'object' && actual !== null && expected !== null) {
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
  const actualValue = getNestedValue(responseBody, assertion.field);
  const operator = assertion.operator;
  const expectedValue = assertion.value;

  let passed = false;
  let message: string | undefined;

  switch (operator) {
    case 'EXISTS': {
      passed = actualValue !== undefined && actualValue !== null;
      message = passed
        ? `Field "${assertion.field}" exists`
        : `Field "${assertion.field}" does not exist in response`;
      break;
    }

    case 'NOT_EXISTS': {
      passed = actualValue === undefined || actualValue === null;
      message = passed
        ? `Field "${assertion.field}" does not exist`
        : `Field "${assertion.field}" unexpectedly exists`;
      break;
    }

    case 'EQUALS': {
      passed = isEqual(actualValue, expectedValue);
      message = passed
        ? `Field "${assertion.field}" equals expected value`
        : `Expected "${assertion.field}" to equal ${JSON.stringify(expectedValue)}, but received ${JSON.stringify(actualValue)}`;
      break;
    }

    case 'NOT_EQUALS': {
      passed = !isEqual(actualValue, expectedValue);
      message = passed
        ? `Field "${assertion.field}" does not equal specified value`
        : `Expected "${assertion.field}" not to equal ${JSON.stringify(expectedValue)}`;
      break;
    }

    case 'GREATER_THAN': {
      const numActual = typeof actualValue === 'number' ? actualValue : Number(actualValue);
      const numExpected = Number(expectedValue);
      passed = !isNaN(numActual) && !isNaN(numExpected) && numActual > numExpected;
      message = passed
        ? `Field "${assertion.field}" (${numActual}) is greater than ${numExpected}`
        : `Expected "${assertion.field}" (${actualValue}) to be greater than ${expectedValue}`;
      break;
    }

    case 'LESS_THAN': {
      const numActual = typeof actualValue === 'number' ? actualValue : Number(actualValue);
      const numExpected = Number(expectedValue);
      passed = !isNaN(numActual) && !isNaN(numExpected) && numActual < numExpected;
      message = passed
        ? `Field "${assertion.field}" (${numActual}) is less than ${numExpected}`
        : `Expected "${assertion.field}" (${actualValue}) to be less than ${expectedValue}`;
      break;
    }

    case 'CONTAINS': {
      if (typeof actualValue === 'string') {
        passed = actualValue.includes(String(expectedValue));
        message = passed
          ? `Field "${assertion.field}" contains substring "${expectedValue}"`
          : `Field "${assertion.field}" does not contain "${expectedValue}"`;
      } else if (Array.isArray(actualValue)) {
        passed = actualValue.some((item) => isEqual(item, expectedValue));
        message = passed
          ? `Array "${assertion.field}" contains specified element`
          : `Array "${assertion.field}" does not contain expected item`;
      } else {
        passed = false;
        message = `Field "${assertion.field}" is neither a string nor an array`;
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
    name: `JSON Body: ${assertion.field} ${operator}`,
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
    for (const assertion of input.jsonAssertions) {
      if (assertion.field && assertion.operator) {
        results.push(evaluateJsonAssertion(assertion, input.responseBody));
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

