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

