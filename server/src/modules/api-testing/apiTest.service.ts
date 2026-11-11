import { prisma } from '../../utils/prisma.js';
import { encryptCredentials, decryptCredentials } from './crypto.utils.js';
import { executeRealHttpRequest, type AuthExecutionConfig } from './http.executor.js';
import { evaluateTestAssertions } from './assertion.engine.js';
import { diagnosticService } from '../diagnostics/diagnostic.service.js';
import type {
  CreateApiTestDTO,
  UpdateApiTestDTO,
  ExecuteUnsavedTestDTO,
  ApiTestResponse,
  ApiTestRunResponse,
  AuthType,
  TestRunStatus,
} from './apiTest.types.js';

export class ApiTestService {
  /**
   * Helper to format an ApiTest Prisma record into a sanitized API response.
   * Guarantees that sensitive authentication tokens/passwords are NEVER returned.
   */
  private formatApiTestResponse(test: any, lastRun?: any): ApiTestResponse {
    const hasCredentials = Boolean(test.authenticationConfig);

    return {
      id: test.id,
      projectId: test.projectId,
      name: test.name,
      method: test.method,
      url: test.url,
      queryParams: test.queryParams || [],
      headers: test.headers || [],
      requestBody: test.requestBody,
      authenticationType: test.authenticationType as AuthType,
      hasCredentials,
      timeoutMs: test.timeoutMs,
      expectedStatusCode: test.expectedStatusCode,
      expectedResponse: test.expectedResponse || [],
      maxResponseTime: test.maxResponseTime,
      lastRun: lastRun
        ? {
            id: lastRun.id,
            status: lastRun.status as TestRunStatus,
            actualStatusCode: lastRun.actualStatusCode,
            responseTime: lastRun.responseTime,
            executedAt: lastRun.executedAt,
          }
        : null,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
    };
  }

  /**
   * Helper to format an ApiTestRun Prisma record.
   */
  private formatApiTestRunResponse(run: any, diagnosticReport?: any): ApiTestRunResponse {
    return {
      id: run.id,
      projectId: run.projectId,
      apiTestId: run.apiTestId,
      status: run.status as TestRunStatus,
      actualStatusCode: run.actualStatusCode,
      responseTime: run.responseTime,
      responseSize: run.responseSize,
      responseHeaders: run.responseHeaders || {},
      assertionResults: run.assertionResults || [],
      sanitizedResponseBody: run.sanitizedResponseBody,
      errorMessage: run.errorMessage,
      executedAt: run.executedAt,
      diagnosticReport: diagnosticReport ?? undefined,
    };
  }

  /**
   * Creates a new saved API Test configuration.
   * Strictly enforces project ownership through workspace.
   */
  async createApiTest(
    userId: string,
    projectId: string,
    data: CreateApiTestDTO
  ): Promise<ApiTestResponse> {
    // 1. Verify project ownership through workspace
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          ownerId: userId,
        },
      },
    });

    if (!project) {
      const error = new Error('Project not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // 2. Encrypt credentials at rest if provided
    let encryptedCredentials: string | null = null;
    if (data.authenticationType && data.authenticationType !== 'NONE' && data.authenticationConfig) {
      encryptedCredentials = encryptCredentials(data.authenticationConfig);
    }

    // 3. Create test record
    const test = await prisma.apiTest.create({
      data: {
        projectId,
        name: data.name,
        method: data.method as any,
        url: data.url,
        queryParams: (data.queryParams as any) || [],
        headers: (data.headers as any) || [],
        requestBody: typeof data.requestBody === 'object' ? JSON.stringify(data.requestBody) : data.requestBody || null,
        authenticationType: (data.authenticationType as any) || 'NONE',
        authenticationConfig: encryptedCredentials,
        timeoutMs: data.timeoutMs || 5000,
        expectedStatusCode: data.expectedStatusCode ?? null,
        expectedResponse: (data.expectedResponse as any) || [],
        maxResponseTime: data.maxResponseTime ?? null,
      },
    });

    return this.formatApiTestResponse(test);
  }

  /**
   * Lists all saved API tests for a project.
   */
  async listApiTests(userId: string, projectId: string): Promise<ApiTestResponse[]> {
    // 1. Verify project ownership through workspace
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          ownerId: userId,
        },
      },
    });

    if (!project) {
      const error = new Error('Project not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // 2. Fetch tests with latest test run
    const tests = await prisma.apiTest.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        testRuns: {
          orderBy: { executedAt: 'desc' },
          take: 1,
        },
      },
    });

    return tests.map((t) => this.formatApiTestResponse(t, t.testRuns[0]));
  }

  /**
   * Retrieves a single saved API test.
   */
  async getApiTest(userId: string, testId: string): Promise<ApiTestResponse> {
    const test = await prisma.apiTest.findFirst({
      where: {
        id: testId,
        project: {
          workspace: {
            ownerId: userId,
          },
        },
      },
      include: {
        testRuns: {
          orderBy: { executedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!test) {
      const error = new Error('API test not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return this.formatApiTestResponse(test, test.testRuns[0]);
  }

  /**
   * Updates a saved API test.
   */
  async updateApiTest(
    userId: string,
    testId: string,
    data: UpdateApiTestDTO
  ): Promise<ApiTestResponse> {
    const existing = await prisma.apiTest.findFirst({
      where: {
        id: testId,
        project: {
          workspace: {
            ownerId: userId,
          },
        },
      },
    });

    if (!existing) {
      const error = new Error('API test not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const updateData: Record<string, any> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.method !== undefined) updateData.method = data.method;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.queryParams !== undefined) updateData.queryParams = data.queryParams;
    if (data.headers !== undefined) updateData.headers = data.headers;
    if (data.requestBody !== undefined) {
      updateData.requestBody =
        typeof data.requestBody === 'object' ? JSON.stringify(data.requestBody) : data.requestBody;
    }
    if (data.timeoutMs !== undefined) updateData.timeoutMs = data.timeoutMs;
    if (data.expectedStatusCode !== undefined) updateData.expectedStatusCode = data.expectedStatusCode;
    if (data.expectedResponse !== undefined) updateData.expectedResponse = data.expectedResponse;
    if (data.maxResponseTime !== undefined) updateData.maxResponseTime = data.maxResponseTime;

    if (data.authenticationType !== undefined) {
      updateData.authenticationType = data.authenticationType;
      if (data.authenticationType === 'NONE') {
        updateData.authenticationConfig = null;
      }
    }

    if (data.authenticationConfig !== undefined && (data.authenticationType || existing.authenticationType) !== 'NONE') {
      updateData.authenticationConfig = encryptCredentials(data.authenticationConfig);
    }

    const updated = await prisma.apiTest.update({
      where: { id: testId },
      data: updateData,
    });

    return this.formatApiTestResponse(updated);
  }

  /**
   * Deletes a saved API test.
   */
  async deleteApiTest(userId: string, testId: string): Promise<void> {
    const deleteResult = await prisma.apiTest.deleteMany({
      where: {
        id: testId,
        project: {
          workspace: {
            ownerId: userId,
          },
        },
      },
    });

    if (deleteResult.count === 0) {
      const error = new Error('API test not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
  }

  /**
   * Executes a saved API test, decrypts stored credentials, runs assertions,
   * records the run in the database, and returns the result.
   */
  async runApiTest(
    userId: string,
    testId: string
  ): Promise<{ test: ApiTestResponse; run: ApiTestRunResponse }> {
    const test = await prisma.apiTest.findFirst({
      where: {
        id: testId,
        project: {
          workspace: {
            ownerId: userId,
          },
        },
      },
    });

    if (!test) {
      const error = new Error('API test not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Decrypt credentials if present
    let authConfig: AuthExecutionConfig | null = null;
    if (test.authenticationType !== 'NONE' && test.authenticationConfig) {
      try {
        const decrypted = decryptCredentials<any>(test.authenticationConfig);
        authConfig = {
          type: test.authenticationType as any,
          token: decrypted.token,
          username: decrypted.username,
          password: decrypted.password,
          apiKeyKey: decrypted.key,
          apiKeyValue: decrypted.value,
          apiKeyAddTo: decrypted.addTo || 'HEADER',
        };
      } catch (err) {
        console.warn('Failed to decrypt credentials for test:', test.id);
      }
    }

    // Execute HTTP request
    const execution = await executeRealHttpRequest({
      method: test.method,
      url: test.url,
      queryParams: test.queryParams as any,
      headers: test.headers as any,
      requestBody: test.requestBody,
      auth: authConfig,
      timeoutMs: test.timeoutMs,
    });

    // Evaluate assertions
    const evaluation = evaluateTestAssertions({
      actualStatusCode: execution.statusCode,
      actualResponseTime: execution.responseTime,
      responseBody: execution.parsedBody,
      expectedStatusCode: test.expectedStatusCode,
      maxResponseTime: test.maxResponseTime,
      jsonAssertions: test.expectedResponse as any,
      isExecutionError: execution.isExecutionError,
    });

    // Record test run in database
    const run = await prisma.apiTestRun.create({
      data: {
        projectId: test.projectId,
        apiTestId: test.id,
        status: evaluation.status as any,
        actualStatusCode: execution.statusCode,
        responseTime: execution.responseTime,
        responseSize: execution.responseSize,
        responseHeaders: execution.responseHeaders,
        assertionResults: evaluation.assertionResults as any,
        sanitizedResponseBody: execution.rawBody.slice(0, 65536),
        errorMessage: execution.errorMessage || null,
      },
    });

    // Generate and persist diagnostic report (non-blocking — failure must NOT crash execution)
    const diagnosticReport = await diagnosticService.generateAndPersistDiagnostic({
      apiTestRunId: run.id,
      projectId: test.projectId,
      input: {
        method: test.method,
        url: test.url,
        authenticationType: test.authenticationType,
        isExecutionError: execution.isExecutionError,
        statusCode: execution.statusCode,
        responseTime: execution.responseTime,
        responseHeaders: execution.responseHeaders,
        sanitizedResponseBody: execution.rawBody.slice(0, 65536),
        errorMessage: execution.errorMessage || null,
        assertionResults: evaluation.assertionResults,
        maxResponseTime: test.maxResponseTime ?? null,
        expectedStatusCode: test.expectedStatusCode ?? null,
        timeoutMs: test.timeoutMs,
      },
    });

    return {
      test: this.formatApiTestResponse(test, run),
      run: this.formatApiTestRunResponse(run, diagnosticReport),
    };
  }

  /**
   * Executes an unsaved ad-hoc API test.
   * Optionally persists the execution run if saveRun === true.
   */
  async executeUnsavedTest(
    userId: string,
    projectId: string,
    data: ExecuteUnsavedTestDTO
  ): Promise<ApiTestRunResponse> {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          ownerId: userId,
        },
      },
    });

    if (!project) {
      const error = new Error('Project not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    let authConfig: AuthExecutionConfig | null = null;
    if (data.authenticationType && data.authenticationType !== 'NONE' && data.authenticationConfig) {
      authConfig = {
        type: data.authenticationType as any,
        token: data.authenticationConfig.token,
        username: data.authenticationConfig.username,
        password: data.authenticationConfig.password,
        apiKeyKey: data.authenticationConfig.key,
        apiKeyValue: data.authenticationConfig.value,
        apiKeyAddTo: data.authenticationConfig.addTo || 'HEADER',
      };
    }

    // Execute HTTP request
    const execution = await executeRealHttpRequest({
      method: data.method,
      url: data.url,
      queryParams: data.queryParams,
      headers: data.headers,
      requestBody: data.requestBody,
      auth: authConfig,
      timeoutMs: data.timeoutMs || 5000,
    });

    // Evaluate assertions
    const evaluation = evaluateTestAssertions({
      actualStatusCode: execution.statusCode,
      actualResponseTime: execution.responseTime,
      responseBody: execution.parsedBody,
      expectedStatusCode: data.expectedStatusCode,
      maxResponseTime: data.maxResponseTime,
      jsonAssertions: data.expectedResponse,
      isExecutionError: execution.isExecutionError,
    });

    // Save run if requested
    if (data.saveRun) {
      const run = await prisma.apiTestRun.create({
        data: {
          projectId,
          apiTestId: null,
          status: evaluation.status as any,
          actualStatusCode: execution.statusCode,
          responseTime: execution.responseTime,
          responseSize: execution.responseSize,
          responseHeaders: execution.responseHeaders,
          assertionResults: evaluation.assertionResults as any,
          sanitizedResponseBody: execution.rawBody.slice(0, 65536),
          errorMessage: execution.errorMessage || null,
        },
      });

      // Generate and persist diagnostic report (non-blocking)
      const diagnosticReport = await diagnosticService.generateAndPersistDiagnostic({
        apiTestRunId: run.id,
        projectId,
        input: {
          method: data.method,
          url: data.url,
          authenticationType: data.authenticationType || 'NONE',
          isExecutionError: execution.isExecutionError,
          statusCode: execution.statusCode,
          responseTime: execution.responseTime,
          responseHeaders: execution.responseHeaders,
          sanitizedResponseBody: execution.rawBody.slice(0, 65536),
          errorMessage: execution.errorMessage || null,
          assertionResults: evaluation.assertionResults,
          maxResponseTime: data.maxResponseTime ?? null,
          expectedStatusCode: data.expectedStatusCode ?? null,
          timeoutMs: data.timeoutMs || 5000,
        },
      });

      return this.formatApiTestRunResponse(run, diagnosticReport);
    }

    // Return ephemeral execution result with inline diagnostic (not persisted)
    const diagnosticReport = diagnosticService.generateEphemeralDiagnostic({
      method: data.method,
      url: data.url,
      authenticationType: data.authenticationType || 'NONE',
      isExecutionError: execution.isExecutionError,
      statusCode: execution.statusCode,
      responseTime: execution.responseTime,
      responseHeaders: execution.responseHeaders,
      sanitizedResponseBody: execution.rawBody.slice(0, 65536),
      errorMessage: execution.errorMessage || null,
      assertionResults: evaluation.assertionResults,
      maxResponseTime: data.maxResponseTime ?? null,
      expectedStatusCode: data.expectedStatusCode ?? null,
      timeoutMs: data.timeoutMs || 5000,
    });

    return {
      id: 'ephemeral-run',
      projectId,
      apiTestId: null,
      status: evaluation.status as any,
      actualStatusCode: execution.statusCode,
      responseTime: execution.responseTime,
      responseSize: execution.responseSize,
      responseHeaders: execution.responseHeaders,
      assertionResults: evaluation.assertionResults,
      sanitizedResponseBody: execution.rawBody.slice(0, 65536),
      errorMessage: execution.errorMessage || null,
      executedAt: new Date(),
      diagnosticReport,
    };
  }

  /**
   * Retrieves test run execution history for a saved API test.
   */
  async listTestRuns(
    userId: string,
    testId: string,
    page = 1,
    limit = 20
  ): Promise<{ runs: ApiTestRunResponse[]; pagination: any }> {
    const test = await prisma.apiTest.findFirst({
      where: {
        id: testId,
        project: {
          workspace: {
            ownerId: userId,
          },
        },
      },
    });

    if (!test) {
      const error = new Error('API test not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [totalCount, runs] = await Promise.all([
      prisma.apiTestRun.count({ where: { apiTestId: testId } }),
      prisma.apiTestRun.findMany({
        where: { apiTestId: testId },
        orderBy: { executedAt: 'desc' },
        skip,
        take: safeLimit,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / safeLimit) || 1;

    return {
      runs: runs.map((r) => this.formatApiTestRunResponse(r)),
      pagination: {
        page: safePage,
        limit: safeLimit,
        totalCount,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      },
    };
  }

  /**
   * Retrieves a single test run result by ID.
   */
  async getTestRun(userId: string, runId: string): Promise<ApiTestRunResponse> {
    const run = await prisma.apiTestRun.findFirst({
      where: {
        id: runId,
        project: {
          workspace: {
            ownerId: userId,
          },
        },
      },
    });

    if (!run) {
      const error = new Error('Test run not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return this.formatApiTestRunResponse(run);
  }
}

export const apiTestService = new ApiTestService();

