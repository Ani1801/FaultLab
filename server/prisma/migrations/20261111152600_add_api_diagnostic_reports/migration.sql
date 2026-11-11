-- CreateEnum
CREATE TYPE "DiagnosticStatus" AS ENUM ('HEALTHY', 'WARNING', 'CRITICAL_ISSUES');

-- CreateTable
CREATE TABLE "api_diagnostic_reports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "apiTestRunId" TEXT,
    "overallStatus" "DiagnosticStatus" NOT NULL DEFAULT 'HEALTHY',
    "summary" TEXT NOT NULL,
    "totalFindings" INTEGER NOT NULL DEFAULT 0,
    "findings" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_diagnostic_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_diagnostic_reports_apiTestRunId_key" ON "api_diagnostic_reports"("apiTestRunId");

-- CreateIndex
CREATE INDEX "api_diagnostic_reports_projectId_createdAt_idx" ON "api_diagnostic_reports"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "api_diagnostic_reports_overallStatus_idx" ON "api_diagnostic_reports"("overallStatus");

-- AddForeignKey
ALTER TABLE "api_diagnostic_reports" ADD CONSTRAINT "api_diagnostic_reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_diagnostic_reports" ADD CONSTRAINT "api_diagnostic_reports_apiTestRunId_fkey" FOREIGN KEY ("apiTestRunId") REFERENCES "api_test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
