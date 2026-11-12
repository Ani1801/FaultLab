-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ONLINE', 'OFFLINE', 'REVOKED');

-- CreateEnum
CREATE TYPE "AgentTaskStatus" AS ENUM ('PENDING', 'PICKED_UP', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "local_agents" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "approvedOrigin" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'ONLINE',
    "lastSeenAt" TIMESTAMP(3),
    "systemInfo" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_pairing_sessions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "approvedOrigin" TEXT NOT NULL,
    "agentName" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_pairing_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_tasks" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'EXECUTE_API_TEST',
    "status" "AgentTaskStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "apiTestRunId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "local_agents_tokenHash_key" ON "local_agents"("tokenHash");

-- CreateIndex
CREATE INDEX "local_agents_projectId_idx" ON "local_agents"("projectId");

-- CreateIndex
CREATE INDEX "local_agents_tokenHash_idx" ON "local_agents"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "agent_pairing_sessions_codeHash_key" ON "agent_pairing_sessions"("codeHash");

-- CreateIndex
CREATE INDEX "agent_pairing_sessions_projectId_idx" ON "agent_pairing_sessions"("projectId");

-- CreateIndex
CREATE INDEX "agent_pairing_sessions_codeHash_idx" ON "agent_pairing_sessions"("codeHash");

-- CreateIndex
CREATE INDEX "agent_tasks_agentId_status_idx" ON "agent_tasks"("agentId", "status");

-- CreateIndex
CREATE INDEX "agent_tasks_projectId_idx" ON "agent_tasks"("projectId");

-- AddForeignKey
ALTER TABLE "local_agents" ADD CONSTRAINT "local_agents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_pairing_sessions" ADD CONSTRAINT "agent_pairing_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "local_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
