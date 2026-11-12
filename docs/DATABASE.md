# FaultLab – Database Architecture & Prisma Guide

## 1. Overview

FaultLab uses **PostgreSQL** as its primary relational database, managed through **Prisma ORM**.

Phase 1 establishes the baseline schema with foundational models for multi-tenant isolation: `User` and `Workspace`.

---

## 2. Entity-Relationship Schema

### Conceptual Diagram

```
+------------------------------------+
|                User                |
+------------------------------------+
| id           String (UUID) [PK]    |
| name         String                |
| email        String [Unique]       |
| passwordHash String                |
| createdAt    DateTime              |
| updatedAt    DateTime              |
+------------------------------------+
                 | 1
                 |
                 | has many
                 |
                 | *
+------------------------------------+
|             Workspace              |
+------------------------------------+
| id           String (UUID) [PK]    |
| name         String                |
| ownerId      String [FK -> User]   |
| createdAt    DateTime              |
| updatedAt    DateTime              |
+------------------------------------+
```

### Prisma Schema (`server/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id           String      @id @default(uuid())
  name         String
  email        String      @unique
  passwordHash String
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  workspaces   Workspace[]

  @@map("users")
}

model Workspace {
  id        String   @id @default(uuid())
  name      String
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ownerId])
  @@map("workspaces")
}
```

### Relational Details:
- **`User`**: Root identity for workspace ownership.
- **`Workspace`**: Tenant boundary for simulated endpoints and fault rules.
- **Foreign Key**: `Workspace.ownerId` references `User.id` with `onDelete: Cascade` to ensure referential integrity.
- **Indexes**: An index is placed on `Workspace.ownerId` to guarantee rapid querying by owner.

---

## 3. PostgreSQL Configuration

### Connection String Format
Prisma connects to PostgreSQL using the standard URI schema:

```
postgresql://<USERNAME>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>?schema=<SCHEMA>
```

Default development configuration in `server/.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/faultlab?schema=public
```

---

## 4. Setting Up PostgreSQL

### Option A: Local PostgreSQL Server
1. Install PostgreSQL on your operating system (or start the Windows PostgreSQL service):
   ```powershell
   Start-Service postgresql*
   ```
2. Create the `faultlab` database using `psql`:
   ```bash
   psql -U postgres -c "CREATE DATABASE faultlab;"
   ```

### Option B: Cloud PostgreSQL (Supabase / Neon / Render / AWS RDS)
1. Provision a free PostgreSQL instance on Neon or Supabase.
2. Copy the connection string and paste it into `server/.env` under `DATABASE_URL`.

---

## 5. Prisma Migration & Client Workflow

### Generating the Prisma Client
To generate or regenerate the type-safe Prisma client:
```bash
# From repository root
npm run prisma:generate

# Or directly in server/
cd server
npx prisma generate
```

### Executing Migrations
When your PostgreSQL instance is running:
```bash
# From repository root
npm run prisma:migrate

# Or directly in server/
cd server
npx prisma migrate dev --name init_users_and_workspaces
```

This creates an idempotent SQL migration file under `server/prisma/migrations/` and updates the database schema.

### Inspecting Data with Prisma Studio
Prisma provides a visual database browser:
```bash
cd server
npx prisma studio
```
This launches a web dashboard at `http://localhost:5555`.

---

## 6. Real-Time Connectivity Verification

FaultLab does NOT fake database connectivity. The health endpoint (`GET /api/v1/health`) executes:
```typescript
await prisma.$queryRaw`SELECT 1`;
```
- If connected: response includes exact latency in milliseconds.
- If disconnected: returns detailed diagnostic message while keeping the Express server operational.

---

## 7. Phase 3A: Workspace Queries & Isolation Patterns

### 7.1 Multi-Tenant Filtering & Atomic Mutation Patterns
In multi-tenant applications, failing to scope queries by the authenticated user's ID introduces Insecure Direct Object Reference (IDOR) vulnerabilities and race conditions. In FaultLab:

```typescript
// Safe Workspace Retrieval (Read)
const workspace = await prisma.workspace.findFirst({
  where: {
    id: workspaceId,
    ownerId: userId, // Scoped to owner
  },
});

// Safe Workspace Mutation (Update)
const updateResult = await prisma.workspace.updateMany({
  where: { id: workspaceId, ownerId: userId },
  data: { name: trimmedName },
});
if (updateResult.count === 0) throw new NotFoundError('Workspace not found');

// Safe Workspace Mutation (Delete)
const deleteResult = await prisma.workspace.deleteMany({
  where: { id: workspaceId, ownerId: userId },
});
if (deleteResult.count === 0) throw new NotFoundError('Workspace not found');
```

### 7.2 Index Optimization
Workspaces are heavily queried by `ownerId` when rendering user dashboards. The schema explicitly declares:
```prisma
@@index([ownerId])
```
This produces a B-tree index in PostgreSQL on the `ownerId` column, eliminating table scans and ensuring $O(\log N)$ lookups even as the number of workspaces scales.

### 7.3 Cascading Deletion Strategy
The foreign key constraint uses `onDelete: Cascade`:
```prisma
owner User @relation(fields: [ownerId], references: [id], onDelete: Cascade)
```
- When a `User` account is deleted, PostgreSQL automatically cleans up all associated `workspaces` in the same transaction, preventing orphan records.
- When an individual `Workspace` is deleted via `DELETE /api/v1/workspaces/:id`, only that single workspace record (and in future phases, its associated simulation projects/rules) is removed, without altering the owner `User` account.

---

## 8. Phase 3B: Project Entity & Relational Cascades

### 8.1 Schema Representation
```prisma
model Project {
  id          String    @id @default(uuid())
  name        String
  description String?
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([workspaceId])
  @@map("projects")
}
```

### 8.2 Two-Tier Cascade Integrity
PostgreSQL enforces referential integrity across the entire tree:
1. `User` deletion → triggers cascade to all owned `workspaces` → triggers cascade to all nested `projects`.
2. `Workspace` deletion → triggers cascade to all nested `projects` in that workspace.
3. `Project` deletion → removes only the project row; parent `Workspace` and `User` remain unchanged.

### 8.3 Relational Ownership Traversal
Because `Project` relies on `workspaceId`, relation filters in Prisma execute atomic checks:
```typescript
await prisma.project.updateMany({
  where: {
    id: projectId,
    workspace: { ownerId: userId },
  },
  data: updateData,
});
```
This maps to an optimized SQL predicate:
```sql
UPDATE projects SET ...
WHERE id = $1 AND EXISTS (
  SELECT 1 FROM workspaces
  WHERE workspaces.id = projects."workspaceId" AND workspaces."ownerId" = $2
);
```

---

## 9. Phase 4: MockEndpoint Entity & Simulation Metadata

### 9.1 Schema Definition
```prisma
enum HttpMethod {
  GET
  POST
  PUT
  PATCH
  DELETE
}

model MockEndpoint {
  id              String      @id @default(uuid())
  projectId       String
  project         Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name            String
  method          HttpMethod
  path            String
  statusCode      Int         @default(200)
  responseBody    Json?       @default("{}")
  responseHeaders Json?
  responseDelay   Int         @default(0)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@unique([projectId, method, path])
  @@index([projectId])
  @@map("mock_endpoints")
}
```

### 9.2 Key Constraints & Indexing Decisions
1. **Compound Uniqueness (`@@unique([projectId, method, path])`)**:
   - Guarantees at the database level that no two endpoints in the same project share the same HTTP method and URL path.
   - Prevents race conditions during concurrent endpoint creation.
2. **Project Index (`@@index([projectId])`)**:
   - Accelerates runtime retrieval: when an incoming request hits `/mock/:projectId/*`, PostgreSQL performs an indexed lookup on `projectId` in $O(\log N)$ time.
3. **Three-Tier Cascade Integrity**:
   - `User` deleted → cascades to `workspaces` → cascades to `projects` → cascades to `mock_endpoints`.
   - `Workspace` deleted → cascades to its `projects` → cascades to its `mock_endpoints`.
   - `Project` deleted → cascades directly to its `mock_endpoints`.
4. **JSON Support (`Json?`)**:
   - Native PostgreSQL `jsonb` storage provides high-performance serialization and deserialization for response payloads and custom HTTP response headers.

---

## 10. Phase 5: Fault Injection Schema & Database Decisions

### 10.1 Schema Extension
```prisma
enum FailureMode {
  NONE
  ALWAYS
  RANDOM
}

model MockEndpoint {
  id                  String      @id @default(uuid())
  projectId           String
  project             Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name                String
  method              HttpMethod
  path                String
  statusCode          Int         @default(200)
  responseBody        Json?       @default("{}")
  responseHeaders     Json?
  responseDelay       Int         @default(0)
  faultEnabled        Boolean     @default(false)
  failureMode         FailureMode @default(NONE)
  failureRate         Int         @default(0)
  failureStatusCode   Int         @default(500)
  failureResponseBody Json?       @default("{\"error\": \"Internal Server Error\", \"message\": \"Simulated fault injection\"}")
  additionalDelay     Int         @default(0)
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  @@unique([projectId, method, path])
  @@index([projectId])
  @@map("mock_endpoints")
}
```

### 10.2 Architectural Rationale for Co-locating Fault Fields
1. **Zero Runtime Overhead**:
   - Storing fault rules on `MockEndpoint` ensures the public simulation runtime (`/mock/:projectId/*`) fetches the endpoint and its fault configuration in a single indexed query. No joins or secondary table lookups are needed.
2. **Atomic Configuration Updates**:
   - Updates to endpoint paths, status codes, and fault rules are executed within a single SQL `UPDATE` statement, eliminating partial state drift.
3. **Graceful Defaults & Backward Compatibility**:
   - Existing endpoints receive `faultEnabled: false`, `failureMode: NONE`, and `additionalDelay: 0`, guaranteeing 100% backward compatibility.

---

## 11. Phase 6: Request History & Analytics Schema

### 11.1 Schema Definition
```prisma
model RequestLog {
  id              String        @id @default(uuid())
  projectId       String
  project         Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  endpointId      String?
  endpoint        MockEndpoint? @relation(fields: [endpointId], references: [id], onDelete: SetNull)
  method          String
  path            String
  statusCode      Int
  responseTime    Int           // Milliseconds elapsed
  requestSize     Int?          // Payload size in bytes
  responseSize    Int?          // Response payload size in bytes
  isFaultInjected Boolean       @default(false)
  wasMatched      Boolean       @default(true)
  createdAt       DateTime      @default(now())

  @@index([projectId, createdAt(sort: Desc)])
  @@index([projectId, statusCode])
  @@index([projectId, method])
  @@index([endpointId])
  @@map("request_logs")
}
```

### 11.2 Architectural Rationale & Indexing Decisions
1. **Referential Integrity & Audit Preservation (`onDelete: SetNull`)**:
   - When an endpoint is deleted, its historical request logs are preserved with `endpointId: null`. This ensures historical analytics and traffic graphs are not distorted by endpoint lifecycle events.
   - When a project is deleted, its associated logs cascade (`onDelete: Cascade`) for clean multi-tenant cleanup.
2. **Optimized Multi-Column Indexes**:
   - `@@index([projectId, createdAt(sort: Desc)])`: Accelerates paginated log listing ordered newest first and bounded time-range queries (`gte`, `lte`).
   - `@@index([projectId, statusCode])` & `@@index([projectId, method])`: Enables high-speed filtering and aggregation metrics by HTTP status code and method.
   - `@@index([endpointId])`: Speeds up endpoint-specific log lookups.
3. **Non-Blocking Ingestion**:
   - Database inserts are executed asynchronously after HTTP responses are dispatched, ensuring 0ms latency impact on simulated client requests.

---

## 12. Phase 7: Real API Testing Engine Schema

### 12.1 Schema Definition & Models
```prisma
enum AuthType {
  NONE
  BEARER
  BASIC
  API_KEY
}

enum TestRunStatus {
  PASSED
  FAILED
  ERROR
}

model ApiTest {
  id                   String        @id @default(uuid())
  projectId            String
  project              Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name                 String
  method               String
  url                  String
  queryParams          Json?         @default("[]")
  headers              Json?         @default("[]")
  requestBody          String?
  authenticationType   AuthType      @default(NONE)
  authenticationConfig String?       // AES-256-GCM encrypted payload at rest
  timeoutMs            Int           @default(15000)
  expectedStatusCode   Int?
  expectedResponse     Json?         @default("[]")
  maxResponseTime      Int?
  runs                 ApiTestRun[]
  createdAt            DateTime      @default(now())
  updatedAt            DateTime      @updatedAt

  @@index([projectId])
  @@index([projectId, createdAt(sort: Desc)])
  @@map("api_tests")
}

model ApiTestRun {
  id                    String        @id @default(uuid())
  projectId             String
  project               Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  apiTestId             String?
  apiTest               ApiTest?      @relation(fields: [apiTestId], references: [id], onDelete: Cascade)
  status                TestRunStatus
  actualStatusCode      Int?
  responseTime          Int           // Milliseconds elapsed
  responseSize          Int?          // Bytes
  responseHeaders       Json?         @default("{}")
  assertionResults      Json?         @default("[]")
  sanitizedResponseBody String?
  errorMessage          String?
  executedAt            DateTime      @default(now())

  @@index([projectId, executedAt(sort: Desc)])
  @@index([apiTestId, executedAt(sort: Desc)])
  @@index([status])
  @@map("api_test_runs")
}
```

### 12.2 Architectural Rationale & Indexing Decisions
1. **Encrypted Credential Storage (`authenticationConfig`)**:
   - Stored as ciphertext string formatted as `iv:authTag:ciphertext` using server-side AES-256-GCM.
   - Plaintext credentials and encrypted ciphertext are never returned via public/management APIs or logs.
2. **Referential Integrity & Cascading Deletions (`onDelete: Cascade`)**:
   - `Project` deletion cascades to all `ApiTest` records and all historical `ApiTestRun` records.
   - `ApiTest` deletion cascades to its child `ApiTestRun` execution history.
   - Unsaved ad-hoc test executions can record `ApiTestRun` with `apiTestId: null` associated directly to the `Project`.
3. **Compound Indexes for High-Performance Queries**:
   - `@@index([projectId, createdAt(sort: Desc)])`: Accelerates listing saved tests ordered newest first.
   - `@@index([apiTestId, executedAt(sort: Desc)])`: Enables paginated execution history lookups per test.
   - `@@index([status])`: Speeds up filtering test runs by outcome (`PASSED`, `FAILED`, `ERROR`).

---

## 13. Phase 8: API Diagnostic Engine Schema (`ApiDiagnosticReport`)

Phase 8 introduces the `ApiDiagnosticReport` model to store automated, deterministic diagnostic findings, root-cause analyses, and actionable remediation suggestions for real API test executions.

### 13.1 DiagnosticStatus Enum & ApiDiagnosticReport Model

```prisma
enum DiagnosticStatus {
  HEALTHY
  WARNING
  CRITICAL_ISSUES
}

model ApiDiagnosticReport {
  id            String            @id @default(uuid())
  projectId     String
  project       Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  apiTestRunId  String?           @unique
  apiTestRun    ApiTestRun?       @relation(fields: [apiTestRunId], references: [id], onDelete: Cascade)
  overallStatus DiagnosticStatus  @default(HEALTHY)
  summary       String
  totalFindings Int               @default(0)
  findings      Json              @default("[]")
  createdAt     DateTime          @default(now())

  @@index([projectId, createdAt(sort: Desc)])
  @@index([overallStatus])
  @@map("api_diagnostic_reports")
}
```

### 13.2 Architectural & Relational Rationale
1. **One-to-One Execution Association (`apiTestRunId @unique`)**:
   - Each persisted `ApiTestRun` has at most one corresponding `ApiDiagnosticReport`.
   - The unique constraint enables atomic `upsert` operations, preventing duplicate report creation if analysis is triggered multiple times for the same run.
2. **Cascade Deletion Integrity (`onDelete: Cascade`)**:
   - Deleting a `Project` cascades to delete all its `ApiDiagnosticReport` records.
   - Deleting an `ApiTestRun` cascades to delete its associated diagnostic report.
3. **Structured JSON Findings Payload (`findings Json`)**:
   - The findings field stores an array of typed `DiagnosticFinding` objects (`code`, `category`, `severity`, `title`, `explanation`, `evidence`, `probableCause`, `recommendedActions`, `confidence`).
   - Using PostgreSQL's native `jsonb` column allows extensible rule additions without schema migrations.
4. **Performance Indexing**:
   - `@@index([projectId, createdAt(sort: Desc)])`: Enables fast paginated queries of diagnostic history per project.
   - `@@index([overallStatus])`: Powers filtered summary counts (`HEALTHY`, `WARNING`, `CRITICAL_ISSUES`).

---

## 14. Phase 9: Local Diagnostic Agent Schema

Phase 9 introduces models to manage local diagnostic agent pairing, revocable authentication, and background task queuing.

### 14.1 Enums & Models

```prisma
enum AgentStatus {
  ONLINE
  OFFLINE
  REVOKED
}

enum AgentTaskStatus {
  PENDING
  PICKED_UP
  COMPLETED
  FAILED
  EXPIRED
}

model LocalAgent {
  id             String       @id @default(uuid())
  projectId      String
  project        Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name           String
  tokenHash      String       @unique
  approvedOrigin String
  status         AgentStatus  @default(ONLINE)
  lastSeenAt     DateTime?
  systemInfo     Json?        @default("{}")
  tasks          AgentTask[]
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([projectId])
  @@index([status])
  @@map("local_agents")
}

model AgentPairingSession {
  id             String    @id @default(uuid())
  projectId      String
  project        Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  codeHash       String    @unique
  approvedOrigin String
  agentName      String?
  isUsed         Boolean   @default(false)
  expiresAt      DateTime
  createdAt      DateTime  @default(now())
  usedAt         DateTime?

  @@index([projectId])
  @@map("agent_pairing_sessions")
}

model AgentTask {
  id           String          @id @default(uuid())
  agentId      String
  agent        LocalAgent      @relation(fields: [agentId], references: [id], onDelete: Cascade)
  projectId    String
  project      Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  type         String          @default("EXECUTE_API_TEST")
  status       AgentTaskStatus @default(PENDING)
  payload      Json
  result       Json?
  apiTestRunId String?
  apiTestRun   ApiTestRun?     @relation(fields: [apiTestRunId], references: [id], onDelete: SetNull)
  expiresAt    DateTime
  pickedUpAt   DateTime?
  completedAt  DateTime?
  createdAt    DateTime        @default(now())

  @@index([agentId, status])
  @@index([projectId, createdAt(sort: Desc)])
  @@map("agent_tasks")
}
```

### 14.2 Security & Operational Design
1. **Hashed Credential Storage**: Neither the pairing code nor the agent token is stored in plaintext. `codeHash` and `tokenHash` store deterministic SHA-256 hashes.
2. **Cascade Isolation**: Deleting a project cascades and removes all associated `LocalAgent`, `AgentPairingSession`, and `AgentTask` records.
3. **Queue Polling Indexes**: `@@index([agentId, status])` enables O(1) polling lookup for `PENDING` tasks assigned to a specific agent.




