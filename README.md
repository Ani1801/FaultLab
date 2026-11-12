# FaultLab

FaultLab is a scalable API simulation and failure-testing platform for testing distributed system resiliency and chaos scenarios.

This repository implements **Phase 1 (Foundations), Phase 2 (Authentication), Phase 3A (Workspaces), Phase 3B (Projects), Phase 4 (Mock Endpoint Simulation), Phase 5 (Fault Injection Engine), Phase 6 (Request History & Analytics Engine), Phase 7 (Real API Testing Engine), Phase 8 (API Diagnostic Engine), and Phase 9 (Local Diagnostic Agent)**.

---

## Architecture Overview

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS (`/client`)
- **Backend**: Node.js, Express, TypeScript (`/server`)
- **Database**: PostgreSQL (hosted on Neon) with Prisma ORM (`/server/prisma`)
- **Authentication**: JWT stored in secure HttpOnly cookies, bcryptjs password hashing
- **Mock Runtime Engine**: Public simulation router (`/mock/:projectId/*`) supporting custom status codes, delays, dynamic route parameters (`:id`), and custom headers
- **Fault Injection Engine**: Simulates unreliable APIs, configurable error rates, probabilistic failure modes, and latency
- **Request History & Analytics Engine**: Non-blocking asynchronous request recording, aggregate performance metrics, SVG volume visualization, and filterable history logs
- **Real API Testing Engine**: Safe outbound HTTP testing against external live APIs, multi-layer SSRF defense, AES-256-GCM credential encryption, deterministic assertion engine (status, latency, nested JSON paths), saved test suites, and execution run history
- **API Diagnostic Engine**: Deterministic rule-based automated troubleshooting system that analyzes real API test results, categorizes root causes into 7 domains (HTTP Status, Authentication, Request Config, Response, Network/Connection, Performance, Assertion), calculates overall diagnostic health, and provides actionable debugging recommendations with evidence
- **Local Diagnostic Agent**: Standalone background worker (`/packages/faultlab-agent`) enabling safe testing of local microservices (`localhost:PORT`) via outbound-only HTTPS polling, short-lived pairing sessions (`FLAB-XXXX-YYYY`), revocable tokens (`fla_*`), strict origin guards, and client-side credential redaction
- **Configuration**: Zod validation for runtime environment variables
- **Documentation**: Comprehensive architectural, database, security, and learning notes guides (`/docs`)

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **PostgreSQL**: Local or remote instance (optional for initial startup, required for database operations)

### 2. Environment Setup

Copy `.env.example` templates for both server and client:

```bash
# Server environment
cp server/.env.example server/.env

# Client environment
cp client/.env.example client/.env
```

Ensure `DATABASE_URL` in `server/.env` points to your PostgreSQL database.

### 3. Installation

Install dependencies across the monorepo:

```bash
npm install
npm --prefix server install
npm --prefix client install
```

Generate the Prisma client:
```bash
npm run prisma:generate
```

### 4. Running the Development Applications

#### Start both Client and Server concurrently:
```bash
npm run dev
```

#### Or start them independently in separate terminals:
```bash
# Terminal 1 - Backend Server (runs on http://localhost:5000)
npm run dev:server

# Terminal 2 - Frontend Client (runs on http://localhost:5173)
npm run dev:client
```

---

## Automated Testing

Run the automated test suites:
```bash
# API Diagnostic Engine tests (41 tests)
npm run test:diagnostic

# Real API Testing Engine & SSRF Guard tests (32 tests)
npm run test:api-testing

# Request History & Analytics tests (24 tests)
npm run test:request

# Fault Injection & Chaos Engine tests (22 tests)
npm run test:fault

# Mock Endpoint CRUD & Runtime Simulation tests (27 tests)
npm run test:endpoint

# Project CRUD & multi-tenant isolation tests (22 tests)
npm run test:project

# Workspace CRUD & multi-tenant isolation tests (25 tests)
npm run test:workspace

# Authentication & security test suite (15 tests)
npm run test:auth

# Run all test suites sequentially (208 tests)
npm run test:all
```

### API Diagnostic Engine Test Coverage (`test:diagnostic`)
- Deterministic rule categorization across 7 key architectural domains:
  - **Network & Connection**: DNS failure (`NET_001`), connection refused (`NET_002`), malformed URL (`NET_003`), request timeout (`NET_004`), TLS/SSL handshake (`NET_005`), SSRF block (`NET_006`), connection reset (`NET_007`), unclassified network error (`NET_008`)
  - **HTTP Status**: Bad Request (`HTTP_400`), Forbidden (`AUTH_002`), Not Found (`HTTP_404`), Method Not Allowed (`REQ_001`), Conflict (`HTTP_409`), Unprocessable Entity (`HTTP_422`, `REQ_002`), Rate Limit (`HTTP_429`), Internal Server Error (`HTTP_500`), Bad Gateway (`HTTP_502`), Service Unavailable (`HTTP_503`), Gateway Timeout (`HTTP_504`)
  - **Authentication**: Missing credentials on 401 (`AUTH_001_MISSING`), invalid credentials on 401 (`AUTH_001_INVALID`), unencrypted Basic auth over HTTP (`AUTH_003`)
  - **Response Validation**: Content-Type claims JSON but payload is malformed (`RESP_001`), empty body on success code (`RESP_002`)
  - **Performance Heuristics**: User-configured latency threshold exceeded (`PERF_001`), high latency >5000ms warning (`PERF_002`), moderate latency >2000ms observation (`PERF_003`)
  - **Assertion Diagnostics**: Dynamic translation of failed status, latency, and nested JSON body assertions into contextual findings
- Severity sorting (`CRITICAL` > `HIGH` > `MEDIUM` > `LOW` > `INFO`) and overall status derivation (`HEALTHY`, `WARNING`, `CRITICAL_ISSUES`)
- Non-blocking execution safety: diagnostic generation failure never crashes API test execution
- Persistence lifecycle: automatic upserting to `ApiDiagnosticReport` on test execution
- Ephemeral execution handling: unsaved test runs (`saveRun: false`) receive inline diagnostics without database persistence; `saveRun: true` persists report
- REST API verification: `GET /api-test-runs/:runId/diagnostics`, `GET /projects/:projectId/diagnostics` (with pagination and status filtering), and `GET /projects/:projectId/diagnostics/summary`
- Anti-IDOR security: strict tenant isolation across project and workspace hierarchy (404 for unauthorized cross-tenant requests)
- Database integrity: cascade deletion of `ApiDiagnosticReport` records when project is deleted

### Real API Testing Engine Test Coverage (`test:api-testing`)
- Multi-layer SSRF defense: rejection of loopback `127.0.0.1`, `localhost`, private `10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`
- Cloud metadata protection: hard blocks on `169.254.169.254` and `metadata.google.internal`
- Protocol restrictions: blocks non-HTTP schemes (`file:`, `ftp:`, `gopher:`) and malformed URLs
- Redirect safety: intercepts redirects to prohibited private addresses and blocks them
- Outbound HTTP execution: GET with query parameters, POST with JSON body and custom headers, PUT, PATCH, DELETE
- Authentication injection: Bearer token, Basic credentials, and API Key (header & query parameter)
- Execution resilience: HTTP 500 response handled as status 500 rather than connection failure, 204 No Content empty bodies handled cleanly, plain text responses preserved without JSON parse errors
- Hard request timeouts: aborts execution when target latency exceeds configured timeout
- Deterministic assertion validation: expected status match vs mismatch, JSON field `EXISTS`, `NOT_EXISTS`, `EQUALS`, `GREATER_THAN`, `CONTAINS`, latency threshold `maxResponseTime`
- Saved test lifecycle: creation with AES-256-GCM encrypted credentials, masking of secrets in responses (`hasCredentials: true`), updating and deleting tests
- Multi-tenant security: anti-IDOR checks (404 for foreign users attempting to read or execute another user's test)
- Cascading integrity: deleting a test cascades to historical test runs; deleting a project cascades to tests and runs
- Paginated execution history: retrieving previous test runs with detailed assertion outcomes


### Request History & Analytics Test Coverage (`test:request`)
- Asynchronous non-blocking logging for all mock requests
- Normal response metrics: exact status code, response time, payload sizes
- Injected failure tracking: `isFaultInjected: true` and simulated failure status
- Response latency accurate measurement including simulated delay
- Unmatched routes logging with 404, `wasMatched: false`, and `endpointId: null`
- Resilient non-blocking execution (logging failure never crashes or delays client responses)
- Authenticated paginated listing ordered newest first (`createdAt: 'desc'`)
- Cross-tenant security: foreign users receive 404 Not Found (anti-IDOR)
- Multi-parameter filtering: HTTP method, status code, endpoint ID, fault injected, path search
- Single request detail inspection with endpoint association
- Aggregate metrics: success rate %, average/min/max response time, status/method breakdown
- Time-series volume bucketing for 24h, 7d, and 30d windows
- Referential actions: `onDelete: SetNull` on endpoint deletion, `onDelete: Cascade` on project deletion


### Fault Injection Test Coverage (`test:fault`)
- Input validation: rejects failure rate < 0 or > 100, status < 400 or > 599, additional delay < 0 or > 10000ms
- Fault creation with `ALWAYS`, `RANDOM`, and `NONE` modes
- Controlled branching tests for probability failure rates
- Verification of 0% failure rate (never produces fault) and 100% failure rate (always produces fault)
- Additional latency injection independently of failure mode
- Combined normal and additional latency calculations
- Preserved custom response headers during simulated failures
- Immediate restoration of normal behavior when `faultEnabled` is toggled off
- Multi-tenant security: foreign users cannot read or modify another user's fault configuration


### Mock Endpoint Test Coverage (`test:endpoint`)
- Management CRUD operations (`POST`, `GET`, `PATCH`, `DELETE`)
- Multi-tenant security: cross-tenant access returns HTTP 404 (anti-IDOR)
- Path normalization: auto-prefixing leading slash, trailing slash removal
- Duplicate prevention: compound uniqueness `[projectId, method, path]` returns HTTP 409 Conflict
- Public unauthenticated mock simulation engine (`/mock/:projectId/*`)
- Dynamic parameter route matching (e.g. `/users/:id` matching `/users/123`)
- Priority sorting: exact static match preferred over parameterized routes
- Non-blocking configurable response latency (`responseDelay` up to 10s)
- Custom response headers and empty 204 No Content payloads
- Non-matching method rejection (HTTP 404) and unknown path rejection (HTTP 404)
- Database cascade deletion: deleting a project cascades to all its mock endpoints
- Clean test teardown via `try/finally` isolating test records


### Project Test Coverage (`test:project`)
- Authentication guard enforcement (401 for unauthenticated calls)
- Input validation (project name 2-64 chars, description max 500 chars, whitespace handling)
- Parameter validation (rejection of malformed workspace and project UUIDs with HTTP 400)
- Foreign workspace injection rejection (404 for creating project in another user's workspace)
- Multi-tenant project listing isolation (scoped strictly to owned workspace)
- Anti-IDOR: Non-owner retrieval, update, and deletion attempts receive 404 Not Found
- Atomic ownership enforcement via relation filters (`updateMany` / `deleteMany`)
- Clearing descriptions via `null` or empty string
- Rejection of unexpected body fields (`.strict()`)
- Workspace cascade deletion (deleting a workspace removes all its projects)
- Safe teardown via `try/finally` cleaning up only test-created records

### Workspace Test Coverage (`test:workspace`)
- Authentication guard enforcement (401 for unauthenticated calls)
- Workspace name validation (2 to 64 characters, non-empty, trimmed)
- Prevention of client-forged `ownerId`
- Multi-tenant workspace listing isolation (User A never sees User B's workspaces)
- Workspace detail retrieval (`GET /:id`)
- IDOR defense: Non-owner access attempts receive 404 Not Found (concealing existence)
- Atomic ownership enforcement in database mutations (`updateMany` / `deleteMany`)
- Workspace renaming (`PATCH /:id`) and payload verification
- Workspace deletion (`DELETE /:id`) and cascade verification
- Nonexistent UUIDs and malformed UUID formats (HTTP 400 & 404)
- Isolated teardown via `try/finally` guaranteeing cleanup of test-only records

### Authentication Test Coverage (`test:auth`)
- User registration and bcrypt password hashing
- Validation rules (email format, password complexity)
- Duplicate email prevention (HTTP 409 Conflict)
- Generic credential failure messages (anti-enumeration)
- JWT signing and signature verification
- HttpOnly cookie setting and clearing
- Session persistence via `GET /api/v1/auth/me`
- Guaranteed absence of `passwordHash` in responses
- Tampered and expired token rejection

---

## Health Check & Verification

Once running:
- **Client UI**: [http://localhost:5173](http://localhost:5173)
- **Backend Health Check**: [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)

The health check validates both server status and live PostgreSQL connectivity.

---

## Database Migrations

When your PostgreSQL instance is active, apply the initial migration:
```bash
npm run prisma:migrate
```

To view the database GUI:
```bash
cd server && npx prisma studio
```

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – Monorepo structure, folder responsibilities, and system design
- [docs/DATABASE.md](docs/DATABASE.md) – Database schema, entity relationships, and Prisma workflows
- [docs/LEARNING_NOTES.md](docs/LEARNING_NOTES.md) – Architectural decisions, trade-offs, and design notes
- [docs/LOCAL_AGENT_SECURITY.md](docs/LOCAL_AGENT_SECURITY.md) – Local Diagnostic Agent security model, outbound polling, and CLI reference

