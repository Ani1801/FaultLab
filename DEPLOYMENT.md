# FaultLab v0.9.0 — Production Deployment Guide

This guide details the deployment architecture, configuration, and operational procedures for FaultLab on **Vercel** (Frontend), **Render Free** (Backend), and **Neon PostgreSQL** (Database).

---

## 1. Architecture & Free-Tier Operational Overview

```
┌──────────────────────────────────────────────────────────┐
│                   Client Browser                         │
└────────────────────────────┬─────────────────────────────┘
                             │ Same-origin HTTPS requests
                             ▼
┌──────────────────────────────────────────────────────────┐
│              Vercel Frontend & Proxy                     │
│         https://<your-app>.vercel.app                    │
│  - Static assets (Vite React SPA)                        │
│  - Reverse Proxy rewrites (vercel.json):                 │
│      /api/v1/*  ──►  Render Backend /api/v1/*            │
│      /mock/*    ──►  Render Backend /mock/*              │
└────────────────────────────┬─────────────────────────────┘
                             │ Forwarded HTTPS + HttpOnly Cookies
                             ▼
┌──────────────────────────────────────────────────────────┐
│           Render Free Web Service (Node.js)              │
│       https://<your-backend>.onrender.com                │
│  - Binds to 0.0.0.0 on process.env.PORT (default 10000)  │
│  - Spins down after 15 min inactivity (cold start: ~50s) │
│  - Express rate limiting & resource guards               │
└──────────────┬────────────────────────────┬──────────────┘
               │ Normal queries             │ Migration DDL
               │ (PgBouncer Pooled)         │ (Direct Connection)
               ▼                            ▼
┌──────────────────────────────────────────────────────────┐
│                 Neon PostgreSQL                          │
│  - DATABASE_URL (ep-*-pooler)  ──► PgBouncer Pool        │
│  - DIRECT_URL   (ep-*)         ──► PostgreSQL Direct     │
└──────────────────────────────────────────────────────────┘
```

> [!NOTE]
> **Render Free Plan Cold Starts**:
> Render Free web services spin down after 15 minutes of inactivity. When a request arrives after inactivity, the first response can take **30 to 50 seconds** while the container starts. The FaultLab frontend is configured with targeted cold-start tolerance (50s timeout with a bounded safe retry on idempotent `GET` endpoints) to gracefully handle these initial delays.

---

## 2. Runtime & Node.js Requirement

- **Supported Node.js Version**: **Node.js 24 LTS** (e.g. `24.x` or target `24.22.3`).
- **Prisma Compatibility**: Prisma CLI and `@prisma/client` `6.3.1` are verified on Node.js 24 LTS.
- Specify Node 24 in Render environment or via `.node-version` / `.nvmrc`:
  ```
  24.22.3
  ```
- Both root `package.json` and `server/package.json` enforce engines: `"node": ">=24.0.0"`.

---

## 3. Neon PostgreSQL Database Setup

### 3.1 Project and Database Creation
1. Sign in to the [Neon Console](https://console.neon.tech).
2. Create a new project named `faultlab`.
3. Ensure a database named `faultlab` exists.

### 3.2 Pooled vs. Direct Connection Strings

Neon provides two distinct connection strings in the **Connection Details** dashboard:

| Connection Variable | Neon Dashboard Setting | Host Pattern | Purpose & Requirements |
| :--- | :--- | :--- | :--- |
| **`DATABASE_URL`** | **Connection pooling: ON** | `ep-[id]-pooler.[region].aws.neon.tech` | **Runtime Queries**: Uses PgBouncer in transaction pooling mode. Prevents connection exhaustion during normal Express request handling. Must include `?sslmode=require`. |
| **`DIRECT_URL`** | **Connection pooling: OFF** | `ep-[id].[region].aws.neon.tech` | **Database Migrations**: Direct connection to the PostgreSQL compute node. Essential for `prisma migrate deploy` because PgBouncer does not support session-level advisory locks (`pg_advisory_lock`). Must include `?sslmode=require`. |

### 3.3 Prisma Datasource Schema
FaultLab's Prisma schema (`server/prisma/schema.prisma`) uses both connections:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

---

## 4. Database Migration Strategies & Free-Tier Constraints

> [!WARNING]
> **Render Pre-Deploy Command Availability**:
> Render's native "Pre-Deploy Command" hook is a **paid feature** and is **NOT available on Render Free web services**. Do not rely on Pre-Deploy commands when running on the Free tier.

### 4.1 Recommended Free-Tier Migration Procedure: Pre-Deployment Manual Migration
The safest approach for Render Free is to execute database migrations from a trusted environment **before** deploying the corresponding backend version:

1. In your local terminal or CI runner, set `DIRECT_URL` to the Neon direct connection string:
   ```powershell
   $env:DIRECT_URL="postgresql://user:pass@ep-direct.neon.tech/faultlab?sslmode=require"
   ```
2. Run Prisma's production migration command:
   ```powershell
   npm run prisma:migrate:deploy
   # or inside server/: npx prisma migrate deploy
   ```
3. Confirm that all migrations applied successfully.
4. Deploy the backend service on Render.

### 4.2 Alternative Strategy: Running Migrations During Build
You can also append `npm run prisma:migrate:deploy` to Render's Build Command:
```bash
npm install --include=dev && npm run prisma:generate && npm run prisma:migrate:deploy && npm run build
```

**Trade-offs of Running Migrations During Build vs. Separately**:
- *Build-time Pros*: Automated on every git push without manual CLI steps.
- *Build-time Cons*: If a migration fails during the build, the build fails before deploying. However, if the build succeeds and compiles, but the app has runtime issues, the database has already been altered. Furthermore, building preview/staging branches could accidentally run production migrations if environment variables are shared.
- *Pre-deployment Manual Pros*: Total control over timing, verifiable before traffic shifts, zero risk of uncontrolled branch migration.

### 4.3 Migration Safety Rules
- **NEVER** run `prisma migrate dev` in production (it creates migration files and can reset the database).
- **NEVER** run `prisma db push` in production (it bypasses migration tracking and may drop tables/columns).
- **ALWAYS** use `prisma migrate deploy` for production database updates.

---

## 5. Backend Deployment on Render (Free Tier)

### 5.1 Service Configuration

Create a new **Web Service** on Render:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Name** | `faultlab-backend` | Service name |
| **Repository** | Connected FaultLab repository | GitHub repo |
| **Branch** | `master` | Main branch |
| **Root Directory** | `server` | Keeps working directory in `/server` |
| **Environment** | `Node` | Runtime |
| **Build Command** | `npm install --include=dev && npm run prisma:generate && npm run build` | Installs dependencies, generates Prisma Client, compiles TypeScript |
| **Start Command** | `npm start` | Runs `node dist/server.js` |
| **Plan Type** | **Free** | Render Free tier |

### 5.2 Server Port & Network Binding
- The backend listens on `process.env.PORT` and explicitly binds to `0.0.0.0`:
  ```ts
  app.listen(env.PORT, '0.0.0.0', () => { ... });
  ```
- **Do not hardcode port 10000**: Render automatically injects `PORT=10000` into `process.env.PORT`. The backend reads this dynamically with a fallback to `5000` for local development.

### 5.3 Required Environment Variables on Render

| Variable Name | Example / Format | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enforces production mode across all security checks |
| `DATABASE_URL` | `postgresql://user:pass@ep-*-pooler.neon.tech/faultlab?sslmode=require` | Neon pooled connection string for runtime queries |
| `DIRECT_URL` | `postgresql://user:pass@ep-*.neon.tech/faultlab?sslmode=require` | Neon direct connection string for Prisma CLI migrations |
| `JWT_SECRET` | 64+ random characters | Key for signing authentication session cookies |
| `JWT_EXPIRES_IN` | `24h` | Session validity duration |
| `COOKIE_NAME` | `faultlab_auth` | HttpOnly cookie name |
| `CORS_ORIGIN` | `https://<your-app>.vercel.app` | Allowed CORS origin (Vercel frontend) |
| `PUBLIC_API_BASE_URL` | `https://<your-backend>.onrender.com` | Public HTTPS backend URL (required in production for Local Agent pairing) |
| `API_TEST_ENCRYPTION_KEY` | 64-hexadecimal characters (32 bytes) | **Master Encryption Key**: Hashed with SHA-256 by FaultLab's crypto module to derive the 256-bit AES-GCM key used to encrypt API credentials. |
| `ALLOW_LOCAL_NETWORK_API_TESTING` | `false` | SSRF protection: blocks tests targeting internal/private IP ranges |

---

## 6. Rate Limiting & Resource Protection Defaults

FaultLab includes built-in in-memory rate limiting and request body limits to protect Render Free resources:

| Route Group | Limit | Window | Key | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`/api/v1/auth/login`, `/register`** | 10 requests | 15 minutes | Client IP | Brute-force credential protection |
| **`/api/v1/projects/:id/agents/pair`** | 10 requests | 15 minutes | User ID / IP | Prevents pairing code flooding |
| **`/api/v1/agent/pair`** | 15 requests | 15 minutes | Client IP | Prevents pairing code guessing |
| **Outbound API Test Runs** | 30 runs | 1 minute | User ID / IP | Controls outbound HTTP socket usage |
| **Diagnostic Generation** | 30 runs | 1 minute | User ID / IP | Prevents CPU consumption |
| **Local Agent Runtime (`/agent/*`)** | 200 requests | 1 minute | Agent Token / IP | High-capacity allowance: guarantees polling/heartbeat traffic is never blocked |
| **Incoming JSON Request Size** | 1 MB | Per request | Request body | Rejects payloads > 1MB with HTTP 413 |
| **Outbound Test Response Size** | 1 MB | Per response | Response body | Truncates response captures to 1MB |
| **Outbound Test Timeout** | Clamped (max 30s) | Per test | AbortSignal | Prevents hung outbound sockets |

> [!NOTE]
> **In-Memory Rate Limiting Scope**:
> Rate limiting is maintained in server process memory. On Render Free, when the service spins down after 15 minutes of inactivity or restarts during deployment, rate limit counters reset. This is appropriate for single-instance free hosting and requires no external Redis service.

---

## 7. Investigating a Failed Migration

If `prisma migrate deploy` fails:
1. **Verify Connection String**: Ensure `DIRECT_URL` is set to the direct host (not the `-pooler` host). PgBouncer rejects advisory locks.
2. **Neon Compute State**: Ensure the Neon database compute is active (waking from suspend can take 2-3s).
3. **Resolving a Partial Migration**:
   - Inspect the failed SQL statement in `server/prisma/migrations/<migration_name>/migration.sql`.
   - Correct the schema in the Neon SQL console if needed.
   - Mark the migration resolved:
     ```bash
     npx prisma migrate resolve --applied <migration_name>
     # OR if rolled back:
     npx prisma migrate resolve --rolled-back <migration_name>
     ```

---

## 8. Local Development vs. Production Commands

| Action | Local Development | Production (Render Free) |
| :--- | :--- | :--- |
| **Install Dependencies** | `npm run install:all` | `npm install --include=dev` |
| **Generate Prisma Client** | `npm run prisma:generate` | `npm run prisma:generate` |
| **Apply Migrations** | `npm run prisma:migrate` (`migrate dev`) | `npm run prisma:migrate:deploy` |
| **Build Server** | `npm run build:server` | `npm run build` |
| **Start Server** | `npm run dev:server` (`tsx watch`) | `npm start` (`node dist/server.js`) |
| **Local Agent Polling** | Active (2s interval) | Bounded backoff (2s active, 20s idle) |
