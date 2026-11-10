-- CreateEnum
CREATE TYPE "HttpMethod" AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE');

-- CreateTable
CREATE TABLE "mock_endpoints" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" "HttpMethod" NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 200,
    "responseBody" JSONB DEFAULT '{}',
    "responseHeaders" JSONB,
    "responseDelay" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mock_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mock_endpoints_projectId_idx" ON "mock_endpoints"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "mock_endpoints_projectId_method_path_key" ON "mock_endpoints"("projectId", "method", "path");

-- AddForeignKey
ALTER TABLE "mock_endpoints" ADD CONSTRAINT "mock_endpoints_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
