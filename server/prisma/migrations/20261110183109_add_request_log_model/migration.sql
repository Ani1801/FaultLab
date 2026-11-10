-- CreateTable
CREATE TABLE "request_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "endpointId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "requestSize" INTEGER,
    "responseSize" INTEGER,
    "isFaultInjected" BOOLEAN NOT NULL DEFAULT false,
    "wasMatched" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_logs_projectId_createdAt_idx" ON "request_logs"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "request_logs_projectId_statusCode_idx" ON "request_logs"("projectId", "statusCode");

-- CreateIndex
CREATE INDEX "request_logs_projectId_method_idx" ON "request_logs"("projectId", "method");

-- CreateIndex
CREATE INDEX "request_logs_endpointId_idx" ON "request_logs"("endpointId");

-- AddForeignKey
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "mock_endpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
