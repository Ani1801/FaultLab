-- CreateEnum
CREATE TYPE "AuthType" AS ENUM ('NONE', 'BEARER', 'BASIC', 'API_KEY');

-- CreateEnum
CREATE TYPE "TestRunStatus" AS ENUM ('PASSED', 'FAILED', 'ERROR');

-- CreateTable
CREATE TABLE "api_tests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" "HttpMethod" NOT NULL,
    "url" TEXT NOT NULL,
    "queryParams" JSONB DEFAULT '[]',
    "headers" JSONB DEFAULT '[]',
    "requestBody" TEXT,
    "authenticationType" "AuthType" NOT NULL DEFAULT 'NONE',
    "authenticationConfig" TEXT,
    "timeoutMs" INTEGER NOT NULL DEFAULT 5000,
    "expectedStatusCode" INTEGER,
    "expectedResponse" JSONB DEFAULT '[]',
    "maxResponseTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_test_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "apiTestId" TEXT,
    "status" "TestRunStatus" NOT NULL,
    "actualStatusCode" INTEGER,
    "responseTime" INTEGER NOT NULL,
    "responseSize" INTEGER,
    "responseHeaders" JSONB,
    "assertionResults" JSONB NOT NULL DEFAULT '[]',
    "sanitizedResponseBody" TEXT,
    "errorMessage" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_tests_projectId_idx" ON "api_tests"("projectId");

-- CreateIndex
CREATE INDEX "api_test_runs_projectId_executedAt_idx" ON "api_test_runs"("projectId", "executedAt" DESC);

-- CreateIndex
CREATE INDEX "api_test_runs_apiTestId_executedAt_idx" ON "api_test_runs"("apiTestId", "executedAt" DESC);

-- AddForeignKey
ALTER TABLE "api_tests" ADD CONSTRAINT "api_tests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_test_runs" ADD CONSTRAINT "api_test_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_test_runs" ADD CONSTRAINT "api_test_runs_apiTestId_fkey" FOREIGN KEY ("apiTestId") REFERENCES "api_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
