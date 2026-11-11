# FaultLab – Architecture & System Design

## 1. Executive Summary

FaultLab is an enterprise-grade API simulation and chaos failure-testing platform designed to allow engineering teams to model real-world API degradations, distributed failures, edge-case HTTP statuses, jitter, and latency before deploying to production.

Phase 1 establishes the foundational monorepo architecture, application bootstrapping, strict TypeScript configurations, centralized middleware, database schemas via Prisma ORM, and live system diagnostics.

---

## 2. Monorepo Structure

FaultLab utilizes a modular monorepo layout separating client, server, and documentation concerns while keeping development streamlined:

```
FaultLab/
├── client/                     # Frontend SPA (React + Vite + TypeScript + Tailwind CSS)
│   ├── src/
│   │   ├── components/         # Reusable UI widgets and presentation cards
│   │   ├── context/            # Global application state providers
│   │   ├── hooks/              # Custom React hooks (e.g., useHealthCheck)
│   │   ├── layouts/            # Page layouts and chrome wrappers
│   │   ├── pages/              # View pages (e.g., HomePage)
│   │   ├── services/           # Backend API communication clients
│   │   ├── types/              # TypeScript interface definitions
│   │   ├── App.tsx             # Root React component
│   │   ├── index.css           # Tailwind directives and global styles
│   │   └── main.tsx            # DOM mounting and React root entry
│   ├── index.html              # HTML shell
│   ├── tailwind.config.js      # Tailwind styling configuration
│   ├── tsconfig.json           # Strict TypeScript client settings
│   └── vite.config.ts          # Vite bundler configuration
│
├── server/                     # Backend API (Node.js + Express + TypeScript)
│   ├── prisma/
│   │   ├── migrations/         # Version-controlled idempotent SQL migrations
│   │   └── schema.prisma       # Prisma ORM schema & data models
│   ├── src/
│   │   ├── config/             # Zod environment variable parsing & schema
│   │   ├── middleware/         # Error handler, auth middleware, request logger, 404 handler
│   │   ├── modules/            # Feature modules (Health, Auth)
│   │   │   ├── auth/           # Authentication controller, service, routes, schemas, types
│   │   │   └── health/         # Health check controller, service, routes, types
│   │   ├── routes/             # Centralized route aggregator (/api/v1)
│   │   ├── utils/              # Prisma client singleton, structured logger
│   │   ├── app.ts              # Express application factory & middleware setup
│   │   └── server.ts           # HTTP server bootstrapping & lifecycle management
│   ├── tsconfig.json           # Strict TypeScript server settings
│   └── .env.example            # Backend environment blueprint
│
├── docs/                       # Project engineering documentation
│   ├── ARCHITECTURE.md         # Foundational architecture, folder purposes, design choices
│   ├── DATABASE.md             # Prisma schemas, relations, migrations, database setup
│   └── LEARNING_NOTES.md       # Architectural decisions, trade-offs, Phase 2 roadmap
│
├── .gitignore                  # Git exclusions for dependencies, env files, and artifacts
├── .env.example                # Blueprint for root environment settings
├── package.json                # Monorepo root scripts & dev orchestration
└── README.md                   # Quick start and repository overview
```

---

## 3. Directory Purposes & Architectural Responsibilities

### Client (`/client`)
- **`components/`**: Atomic, pure, or semi-autonomous visual components (e.g. `HealthStatusCard`, `ProjectPlaceholder`, `Header`).
- **`pages/`**: Routable page compositions that assemble components into coherent workflows.
- **`layouts/`**: Consistent page structures containing persistent navigation and footer framing.
- **`services/`**: Network communication abstraction. Includes `apiClient.ts` (reusable Fetch wrapper with configurable base URL, timeout abort controllers, and error deserialization) and `healthService.ts`.
- **`hooks/`**: Custom React hooks encapsulating asynchronous state, polling intervals, and lifecycles (e.g. `useHealthCheck`).
- **`context/`**: React Context providers for non-local state.
- **`types/`**: Strongly typed TypeScript models matching backend payloads.

### Server (`/server`)
- **`config/`**: Strict environment variable parsing using Zod. Crashes on startup with explanatory diagnostics if required variables are missing or malformed.
- **`modules/`**: Modularized business domains. Each module contains its own routes, controller, service layer, and types.
- **`middleware/`**: Cross-cutting concerns:
  - `requestLogger.ts`: Logs HTTP verb, path, response code, and response time.
  - `errorHandler.ts`: Centralized catch-all handler converting uncaught exceptions into uniform JSON error payloads.
  - `notFoundHandler.ts`: Clean 404 responses for undefined routes.
- **`routes/`**: Central router mounting all modules under `/api/v1`.
- **`utils/`**: Reusable shared utilities:
  - `prisma.ts`: Singleton PrismaClient preventing connection pool exhaustion during hot reload.
  - `logger.ts`: Leveled logging mechanism.
- **`app.ts`**: Builds and configures the Express instance without starting the HTTP socket (enabling future supertest integration testing).
- **`server.ts`**: Binds port, listens for incoming connections, and registers graceful process shutdown hooks (`SIGINT`, `SIGTERM`).

---

## 4. Technology Stack & Rationale

| Layer | Technology | Decision Rationale |
|---|---|---|
| **Frontend Framework** | React 18 + Vite | Blazing-fast HMR, instant builds, modern ES modules, and industry standard ecosystem. |
| **Language** | TypeScript (Strict) | Enforces type safety, eliminates runtime `null`/`undefined` bugs, and provides clear contracts between client and server. |
| **Styling** | Tailwind CSS | Utility-first, zero runtime CSS overhead, rapid iteration, and consistent dark-mode design system. |
| **Backend Runtime** | Node.js + Express | Lightweight, proven, non-blocking asynchronous I/O, ideal for high-concurrency API proxies and failure injectors. |
| **Configuration Validation** | Zod | Runtime schema validation ensures fail-fast behavior before the server attempts network or database calls. |
| **Database & ORM** | PostgreSQL + Prisma | ACID-compliant relational data integrity, fully type-safe generated queries, and migration management. |

---

## 5. Diagnostics & Integration Architecture

Phase 1 features a fully wired end-to-end integration check:
1. Client initiates a poll to `GET /api/v1/health` via `apiClient`.
2. Server executes a low-overhead raw SQL query (`SELECT 1`) against PostgreSQL via Prisma.
3. If PostgreSQL is reachable: returns HTTP 200 with `{ status: "healthy", database: { status: "connected", latencyMs: ... } }`.
4. If PostgreSQL is down or unreachable: returns HTTP 503 with `{ status: "degraded", database: { status: "disconnected", error: ... } }`.
---

## 6. Phase 2: Authentication & Authorization Architecture

### 6.1 Authentication Flow
1. **Registration / Login**:
   - Client sends JSON payload to `POST /api/v1/auth/register` or `POST /api/v1/auth/login`.
   - Zod schemas validate input constraints (min lengths, regex for password strength, email normalization).
   - In `authService`, passwords are encrypted/compared using `bcrypt` (work factor 12).
   - A signed JWT access token is generated containing `{ sub: user.id, email: user.email, name: user.name }`.
   - The token is attached to the response via a secure, `HttpOnly`, `SameSite=Lax` cookie named `faultlab_auth`.
2. **Session Persistence**:
   - On application load, the frontend sends a `GET /api/v1/auth/me` request with `credentials: 'include'`.
   - The browser automatically attaches the `faultlab_auth` cookie.
   - `requireAuth` middleware verifies token signature and expiration, attaches `req.user` to the request, and yields to the controller.
   - Safe user profile (excluding `passwordHash`) is returned to initialize client `AuthContext`.
3. **Session Termination**:
   - `POST /api/v1/auth/logout` instructs the client to clear the cookie via `res.clearCookie('faultlab_auth')` with matching domain and path flags.

### 6.2 Security Controls
- **XSS Immunity**: Access tokens are stored in `HttpOnly` cookies and never exposed to browser JavaScript (`document.cookie` cannot access the token).
- **CSRF Defense**: Cookies are restricted with `SameSite=Lax`. All frontend API calls use JSON payloads with custom `X-Requested-With` headers, triggering mandatory browser CORS preflight checks (`OPTIONS`) that block unauthorized cross-site forgeries.
- **Enumeration Protection**: Login authentication returns identical generic error messages (`Invalid email or password`) regardless of whether the email or password was incorrect.
- **Fail-Fast Configuration**: `JWT_SECRET` is validated at startup with a minimum length of 32 characters.

---

## 7. Phase 3A: Workspace Management Architecture

### 7.1 Multi-Tenant Ownership & IDOR Protection
FaultLab enforces strict data isolation across multiple users:
1. **Implicit Ownership Injection**:
   - `ownerId` is extracted solely from the verified JWT payload attached to `req.user.id` by the `requireAuth` middleware.
   - Client-provided `ownerId` or user identifiers in the JSON body or query strings are ignored, preventing privilege escalation.
2. **Insecure Direct Object Reference (IDOR) Elimination & Atomic Mutation**:
   - For read operations (`GET /:id`), the database query filters simultaneously on `id` AND `ownerId` using `findFirst`.
   - For mutation operations (`PATCH /:id`, `DELETE /:id`), ownership is enforced directly in the database mutation statement itself via Prisma's `updateMany` and `deleteMany`:
     ```typescript
     // Atomic mutation condition preventing TOCTOU race conditions
     const result = await prisma.workspace.deleteMany({
       where: { id: workspaceId, ownerId: userId }
     });
     if (result.count === 0) throw new NotFoundError('Workspace not found');
     ```
   - If `count === 0`, the service throws a `Workspace not found` exception yielding an **HTTP 404 Not Found** response rather than HTTP 403 Forbidden. This prevents malicious tenants from enumerating UUIDs or discovering whether a workspace exists.

### 7.2 API Endpoint Specifications

| Method | Endpoint | Auth Required | Description | Status Codes |
|---|---|---|---|---|
| `POST` | `/api/v1/workspaces` | Yes | Creates a workspace for authenticated user | `201 Created`, `400 Bad Request`, `401 Unauthorized` |
| `GET` | `/api/v1/workspaces` | Yes | Lists all workspaces owned by current user | `200 OK`, `401 Unauthorized` |
| `GET` | `/api/v1/workspaces/:id` | Yes | Retrieves workspace details (ownership enforced) | `200 OK`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found` |
| `PATCH` | `/api/v1/workspaces/:id` | Yes | Renames a workspace (ownership enforced) | `200 OK`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found` |
| `DELETE` | `/api/v1/workspaces/:id` | Yes | Permanently removes workspace and cascades | `200 OK`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found` |

### 7.3 Frontend Architectural Integration
- **`workspaceService.ts`**: Encapsulates all workspace HTTP interactions using the shared `apiClient` configured with `credentials: 'include'`.
- **`DashboardPage.tsx`**: State-driven workspace dashboard presenting live count metrics, real-time list rendering, empty states, and modal controllers.
- **`WorkspaceCard.tsx`**: High-polish presentation card featuring truncated UUID with 1-click clipboard copying, formatted creation timestamps, and contextual actions.
- **`WorkspaceModal.tsx`**: Accessible dialog implementing client-side validation (2 to 64 characters) for creation and rename flows.
- **`DeleteConfirmModal.tsx`**: Destructive action confirmation dialog requiring user consent before deleting workspaces.

---

## 8. Phase 3B: Project Management Architecture

### 8.1 The User → Workspace → Project Hierarchy
FaultLab establishes a clean hierarchical relationship:
```
User (1) ───< owns >─── (N) Workspace (1) ───< contains >─── (N) Project
```
- **Normalized Schema**: `Project` does **not** duplicate `ownerId`. Ownership is strictly derived through the foreign key relation `workspaceId` referencing `Workspace.id`.
- **Relational Authorization**:
  - To verify access to a project, queries traverse the relation:
    ```typescript
    where: {
      id: projectId,
      workspace: { ownerId: userId },
    }
    ```
  - This ensures PostgreSQL verifies the caller owns the parent workspace in the same query via an `EXISTS` subquery or SQL join, eliminating authorization bypasses.

### 8.2 Project API Endpoint Specifications

| Method | Endpoint | Auth Required | Description | Status Codes |
|---|---|---|---|---|
| `POST` | `/api/v1/workspaces/:workspaceId/projects` | Yes | Creates project in specified workspace | `201 Created`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found` |
| `GET` | `/api/v1/workspaces/:workspaceId/projects` | Yes | Lists all projects in workspace | `200 OK`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found` |
| `GET` | `/api/v1/projects/:id` | Yes | Retrieves project details (relational check) | `200 OK`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found` |
| `PATCH` | `/api/v1/projects/:id` | Yes | Updates project name / description | `200 OK`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found` |
| `DELETE` | `/api/v1/projects/:id` | Yes | Deletes project (atomic ownership mutation) | `200 OK`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found` |

### 8.3 Frontend Navigation & Component Hierarchy
- **Breadcrumb Navigation**: Seamless traversal: `Dashboard` > `[Workspace Name]`.
- **`WorkspaceDetailsPage.tsx`**: Dedicated view for an open workspace displaying metadata, project count, and project management controls.
- **`ProjectCard.tsx`**: Displays project name, description (with fallback), copyable UUID badge, formatted creation date, and contextual actions.
- **`ProjectModal.tsx`**: Modal for creating and editing projects, featuring real-time character counters and field validation.
- **`DeleteProjectModal.tsx`**: Accessible destructive confirmation dialog preventing accidental deletions.

---

## 9. Phase 4: API Endpoint Simulation & Mock Runtime Engine

### 9.1 The Hierarchy: User → Workspace → Project → MockEndpoint
FaultLab models simulated endpoints as child resources of projects:
```
User (1) ───< owns >─── (N) Workspace (1) ───< contains >─── (N) Project (1) ───< defines >─── (N) MockEndpoint
```
- **Compound Uniqueness**: `@@unique([projectId, method, path])` guarantees that no two endpoints in the same project can register identical HTTP methods and route paths.
- **Relational Ownership Enforcement**:
  Management operations verify ownership through:
  ```typescript
  where: {
    id: endpointId,
    project: {
      workspace: {
        ownerId: userId,
      },
    },
  }
  ```
  Unauthenticated or non-owning requests receive HTTP 404 Not Found to prevent resource enumeration (anti-IDOR).

### 9.2 Architecture Separation: Management vs. Mock Runtime
FaultLab strictly separates control plane (management) from data plane (runtime simulation):

1. **Management Plane (`/api/v1`)**:
   - Protected by `requireAuth` JWT middleware.
   - Responsible for CRUD operations on mock endpoints, workspace settings, and project metadata.
   - Enforces strict input validation via Zod schemas.

2. **Mock Runtime Engine (`/mock/:projectId/*`)**:
   - **Public & Unauthenticated**: Third-party client apps, curl commands, and frontend prototypes can send requests without authentication tokens.
   - **Permissive CORS**: Configured to accept incoming cross-origin requests from any origin/port to simplify local and distributed testing.
   - **Dynamic Route Matching**: Matches incoming requests against configured routes using a two-pass algorithm:
     - Exact static path match: `candidate.path === request.path`.
     - Parameterized route pattern match: splits path segments by `/` and matches parameter tokens (`:id`, `:slug`) with specificity scoring.
   - **Response Simulation Engine**:
     - Configurable HTTP status codes (100–599).
     - Non-blocking latency delay (`responseDelay` in milliseconds).
     - Custom response headers (`responseHeaders` JSON map).
     - JSON payloads and empty bodies for 204 No Content.

### 9.3 Endpoint Specifications

#### Management API (Authenticated)
| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `POST` | `/api/v1/projects/:projectId/endpoints` | Creates mock endpoint inside a project | `201 Created`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found`, `409 Conflict` |
| `GET` | `/api/v1/projects/:projectId/endpoints` | Lists all endpoints belonging to project | `200 OK`, `401 Unauthorized`, `404 Not Found` |
| `GET` | `/api/v1/endpoints/:id` | Retrieves single endpoint configuration | `200 OK`, `401 Unauthorized`, `404 Not Found` |
| `PATCH` | `/api/v1/endpoints/:id` | Updates endpoint configuration | `200 OK`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found`, `409 Conflict` |
| `DELETE` | `/api/v1/endpoints/:id` | Deletes mock endpoint | `200 OK`, `401 Unauthorized`, `404 Not Found` |

#### Mock Runtime API (Public Simulation)
| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `*` | `/mock/:projectId` | Simulates root path (`/`) for project | Configured status (default `200`), or `404 Not Found` |
| `*` | `/mock/:projectId/*` | Simulates matching subpath for project | Configured status, or `404 Not Found` |

---

## 10. Phase 5: Fault Injection & Chaos Engine

### 10.1 Core Objective
The Fault Injection Engine enables developers to simulate unreliable network boundaries, upstream outages, and latency spikes without writing bespoke chaos testing harnesses.

### 10.2 Failure Modes
1. **`NONE`**: Fault injection remains active only for latency simulation (`additionalDelay`), but all HTTP responses continue to return normal configured payloads and status codes.
2. **`ALWAYS`**: Forced failure mode. Every request targeting this endpoint returns the configured `failureStatusCode` and `failureResponseBody`.
3. **`RANDOM`**: Probabilistic failure mode. Evaluates a pseudorandom draw ($0 \le \text{roll} < 100$). If $\text{roll} < \text{failureRate}$, the failure response is returned; otherwise, the normal simulated response is delivered.

### 10.3 Runtime Execution Pipeline
When an incoming request reaches `/mock/:projectId/*`:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   MOCK RUNTIME EXECUTION PIPELINE                      │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Project & Route Matching                                            │
│    Resolve candidate endpoint via exact path or parameterized match    │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Latency Evaluation                                                  │
│    totalDelay = responseDelay + (faultEnabled ? additionalDelay : 0)   │
│    Apply non-blocking async delay via setTimeout                       │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Header Injection                                                    │
│    Inject configured custom response headers                           │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Fault Injection Decision                                            │
│    If faultEnabled:                                                    │
│      - ALWAYS: shouldInjectFault = true                                │
│      - RANDOM: shouldInjectFault = (Math.random() * 100 < failureRate) │
├────────────────────────────────────────────────────────────────────────┤
│ 5. Response Dispatch                                                   │
│    - If shouldInjectFault: return failureStatusCode & failureBody      │
│    - If 204 No Content: return empty 204 body                          │
│    - Else: return normal statusCode & responseBody                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Phase 6: Request History & Analytics Engine

### 11.1 Overview & Design Goals
The Request History & Analytics Engine enables observability and performance tracking across simulated endpoints. Every request targeting the mock runtime (`/mock/:projectId/*`) is recorded into PostgreSQL asynchronously.

### 11.2 Non-Blocking Ingestion Pipeline
```
Incoming Request -> Mock Route Match -> Latency/Headers/Fault Evaluation
                          │
                          ├─► [Dispatch HTTP Response Immediately to Client]
                          │
                          └─► [Async Fire-and-Forget (catch unhandled)]
                                │
                                ▼
                        requestLogService.recordRequest({
                          projectId, endpointId, method, path,
                          statusCode, responseTime, sizes,
                          isFaultInjected, wasMatched
                        })
```
- **Zero Latency Impact**: Clients receive responses immediately without waiting for database writes.
- **Fault Isolation**: Logging failures are caught safely and never corrupt client responses.

### 11.3 Analytics Aggregation Engine
- **Aggregations**: Database-level `_count`, `_avg`, `_min`, `_max` on `responseTime`.
- **Time-Series Bucketing**:
  - `24h`: 12 buckets at 2-hour intervals.
  - `7d`: 7 daily buckets.
  - `30d`: 15 buckets at 2-day intervals.
- **Metrics Computed**:
  - Total Requests, Successful Requests (2xx/3xx), Failed Requests (4xx/5xx), Injected Faults.
  - Success Rate percentage.
  - Min, Max, Average response times (ms).
  - HTTP status code and method breakdown.
  - Time-series volume breakdown with error and fault segments.

### 11.4 Authenticated APIs
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/projects/:projectId/requests` | Paginated, filterable request logs ordered newest first |
| `GET` | `/api/v1/projects/:projectId/requests/:requestId` | Single request log inspection with ownership verification |
| `GET` | `/api/v1/projects/:projectId/analytics` | Aggregated analytics and time-series buckets (`?timeRange=24h\|7d\|30d`) |

---

## 12. Phase 7: Real API Testing Engine

### 12.1 Overview & System Separation
The Real API Testing Engine allows developers to execute real HTTP requests against external live APIs, define automated assertions on response status, latency, and nested JSON payload fields, and persist test definitions and run histories.

It is strictly separated from the public Mock Runtime (`/mock/:projectId/*`):
- **Mock Runtime**: Inbound traffic simulator returning predefined mock payloads.
- **Real API Testing Engine**: Outbound HTTP test runner executing real external requests from the server with comprehensive SSRF protection and assertion validation.

### 12.2 Multi-Layered SSRF Defense Architecture
To prevent Server-Side Request Forgery (SSRF) and cloud metadata exfiltration:
1. **Protocol Restriction**: Only `http:` and `https:` schemes are allowed. Schemes like `file:`, `ftp:`, `gopher:`, `javascript:` are rejected.
2. **IP Range & CIDR Bitwise Validation**:
   - Loopback (`127.0.0.0/8`, `::1`)
   - Private IPv4 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
   - Carrier-Grade NAT (`100.64.0.0/10`)
   - Link-local & Cloud Metadata (`169.254.0.0/16`, specifically `169.254.169.254` and `metadata.google.internal`)
   - Multicast & Broadcast (`224.0.0.0/4`, `255.255.255.255/32`)
   - IPv6 equivalents (`::1`, `fc00::/7`, `fe80::/10`)
3. **DNS Pre-Resolution**: Hostnames are resolved to actual IP addresses prior to connection and validated against prohibited CIDRs to block DNS rebinding.
4. **Manual Redirect Traversal**: Redirects (`301`, `302`, `307`, `308`) are followed manually (up to a max of 5 hops). Each redirect destination is independently validated against SSRF rules before following.
5. **Execution Limits**: Hard request timeout (default 15s, max 30s) and response payload size limit (max 2MB) prevent memory exhaustion.

### 12.3 Safe Assertion Engine (No dynamic `eval()`)
The assertion engine evaluates test expectations deterministically and safely:
- **Status Code Assertion**: Exact match against expected HTTP status code (e.g. 200, 201).
- **Latency Threshold**: Verifies actual elapsed time is within `maxResponseTime` ms.
- **Nested JSON Path Resolution**: Safely splits dot notation (e.g., `user.profile.roles.0.name`) to traverse nested objects and arrays without executing arbitrary JavaScript code.
- **Supported Operators**:
  - `EXISTS`: Field exists and is neither `undefined` nor `null`.
  - `NOT_EXISTS`: Field is missing, `undefined`, or `null`.
  - `EQUALS`: Loose equality matching (numbers, strings, booleans, objects).
  - `NOT_EQUALS`: Inverse equality matching.
  - `GREATER_THAN`: Numeric comparison (`actual > expected`).
  - `LESS_THAN`: Numeric comparison (`actual < expected`).
  - `CONTAINS`: Substring inclusion for strings, array inclusion for lists, or key inclusion for objects.
- **Test Run Status**: Resolves to `PASSED` (all assertions met), `FAILED` (one or more assertions failed), or `ERROR` (network failure, timeout, SSRF block, or execution abort).

### 12.4 Server-Side Credential Encryption (AES-256-GCM)
Authentication credentials (bearer tokens, basic auth passwords, API keys) stored in `ApiTest.authenticationConfig` are encrypted at rest using AES-256-GCM:
- Master encryption key derived from `API_TEST_ENCRYPTION_KEY` environment variable.
- Each encrypted payload uses a unique initialization vector (`iv`) and cryptographic auth tag (`tag`).
- Management APIs return `hasCredentials: boolean` and never expose plaintext secrets or encrypted ciphertext in API responses or logs.

### 12.5 Authenticated Management Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/projects/:projectId/api-tests` | Create a new saved API test with encrypted credentials |
| `GET` | `/api/v1/projects/:projectId/api-tests` | List all saved API tests for a project with last run summary |
| `GET` | `/api/v1/api-tests/:id` | Retrieve single test configuration (credentials masked) |
| `PATCH` | `/api/v1/api-tests/:id` | Update test configuration (re-encrypts credentials if changed) |
| `DELETE` | `/api/v1/api-tests/:id` | Delete saved test (cascades to all historical runs) |
| `POST` | `/api/v1/api-tests/:id/run` | Execute saved test, record `ApiTestRun`, and update `lastRun` |
| `POST` | `/api/v1/projects/:projectId/api-tests/execute` | Execute unsaved ad-hoc test (optional history recording) |
| `GET` | `/api/v1/api-tests/:id/runs` | Paginated execution history for a saved test |
| `GET` | `/api/v1/api-test-runs/:runId` | Detailed inspection of single historical test run |

---

## 13. Phase 8: API Diagnostic Engine

### 13.1 Overview
The API Diagnostic Engine is a deterministic, rule-based troubleshooting and root-cause analysis system. It evaluates every outbound real API test execution in real time, classifies problems, extracts empirical evidence, determines probable causes, and generates actionable remediation recommendations.

```mermaid
flowchart TD
    Run[Real API Execution / Test Run] --> Input[Diagnostic Input Assembly]
    Input --> Mask[Secret Masking & Sanitization]
    Mask --> RuleEngine[Deterministic Rule Engine]
    
    subgraph Rule Categories
        RuleEngine --> C1[1. Network / Connection Rules]
        RuleEngine --> C2[2. HTTP Status Rules]
        RuleEngine --> C3[3. Authentication Rules]
        RuleEngine --> C4[4. Response Validation Rules]
        RuleEngine --> C5[5. Performance Heuristic Rules]
        RuleEngine --> C6[6. Assertion Outcome Rules]
        RuleEngine --> C7[7. Request Configuration Rules]
    end

    C1 & C2 & C3 & C4 & C5 & C6 & C7 --> Dedupe[Code Deduplication & Severity Sorting]
    Dedupe --> Health[Derive Overall Status: HEALTHY | WARNING | CRITICAL_ISSUES]
    Health --> Summary[Generate Human-Readable Summary]
    Summary --> Report[Construct DiagnosticReport]

    Report --> Persist{Persist to DB?}
    Persist -- Yes: Saved or saveRun=true --> Upsert[Upsert ApiDiagnosticReport]
    Persist -- No: Ephemeral run --> Inline[Return Inline in Response Payload]
```

### 13.2 Categorized Diagnostic Rules
1. **Network & Connection**: Pattern-matches low-level execution errors to distinguish DNS resolution failures (`NET_001`), connection refused (`NET_002`), malformed URLs (`NET_003`), request timeouts (`NET_004`), TLS/SSL certificate problems (`NET_005`), SSRF blocks (`NET_006`), and connection resets (`NET_007`).
2. **HTTP Status**: Maps standard and failure status codes (400, 401, 403, 404, 405, 408, 409, 422, 429, 500, 502, 503, 504) to detailed operational explanations and provider-level troubleshooting steps.
3. **Authentication**: Identifies missing credentials vs. invalid/expired tokens, and flags security risks such as transmitting Basic auth credentials over unencrypted HTTP (`AUTH_003`).
4. **Response Validation**: Identifies serialization mismatches (Content-Type claims JSON but payload is non-JSON or HTML error page) and unexpected empty bodies on success status codes.
5. **Performance Heuristics**: Compares latency against user-configured thresholds (`PERF_001`) and standard heuristics (>5000ms warning `PERF_002`, >2000ms notice `PERF_003`).
6. **Assertion Diagnostics**: Translates failed status, latency, and nested JSON body assertions into clear diagnostic findings referencing expected vs. actual values.

### 13.3 Non-Blocking Execution Guarantee
Diagnostic analysis is executed in a defensive `try / catch` boundary. If rule evaluation fails or encounters an unexpected exception, a fallback diagnostic report is logged and returned without disrupting the core API test execution or throwing an error to the user.

### 13.4 Authenticated Diagnostic Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/api-test-runs/:runId/diagnostics` | Retrieve persisted diagnostic report for a specific test run |
| `GET` | `/api/v1/projects/:projectId/diagnostics` | Paginated project diagnostic history with status filtering |
| `GET` | `/api/v1/projects/:projectId/diagnostics/summary` | Project-level diagnostic metrics (`total`, `healthy`, `warning`, `criticalIssues`) |



