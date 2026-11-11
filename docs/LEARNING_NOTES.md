# FaultLab – Engineering Notes & Design Decisions

## 1. Context & Objectives

Phase 1 focuses exclusively on establishing a rock-solid foundation for FaultLab. The goal was to avoid common early-stage pitfalls such as premature optimization, untyped configurations, monolithic tightly-coupled structures, or simulated mocks that mask environmental failures.

---

## 2. Key Architectural Decisions & Trade-Offs

### 2.1 Monorepo vs. Independent Repositories
- **Decision**: Single modular monorepo (`client/`, `server/`, `docs/`) with root script orchestration.
- **Rationale**: Keeps full-stack development synchronized, enables single-command startup (`npm run dev`), simplifies CI/CD pipelines, and keeps documentation versioned alongside the code.
- **Trade-off**: Requires careful boundary enforcement so frontend code does not import backend files and vice versa.

### 2.2 Express App vs. Server Separation
- **Decision**: Separated `src/app.ts` (Express instance and middleware) from `src/server.ts` (HTTP listen and process lifecycle).
- **Rationale**: Critical for integration testing. Automated tests (e.g. Supertest) can import `app` without binding to a physical network port, avoiding port-collision issues during test execution.

### 2.3 Environment Variable Validation with Zod
- **Decision**: Validate all environment variables at boot time with a Zod schema in `server/src/config/env.ts`.
- **Rationale**: "Fail-fast" principle. If `DATABASE_URL` is omitted or `PORT` is not an integer, the server fails immediately on startup with a human-readable validation error rather than failing unpredictably deep within runtime queries.

### 2.4 Prisma Client Singleton Pattern
- **Decision**: Implemented a global singleton for `PrismaClient` in `server/src/utils/prisma.ts`.
- **Rationale**: In Node.js development environments, tools like `tsx watch` reload modules on file save. Creating a new `PrismaClient` on every reload rapidly exhausts PostgreSQL's connection pool. Attaching the client to `globalThis` in development avoids this issue.

### 2.5 Real Diagnostic Reporting vs. Fake Health Responses
- **Decision**: Execute real `SELECT 1` queries against PostgreSQL during `GET /api/v1/health` and report the true state without masking errors.
- **Rationale**: In failure-testing and chaos-engineering platforms, truthfulness in health metrics is essential. If the database is unreachable, the system must transparently report status `degraded` and the error reason so engineers can take corrective action.

### 2.6 Native Fetch Wrapper vs. Heavy HTTP Libraries
- **Decision**: Built a lightweight, strongly typed API client in `client/src/services/apiClient.ts` based on native `fetch` and `AbortController`.
- **Rationale**: Modern browsers and Node 18+ have native `fetch` support. Avoiding heavy third-party HTTP libraries keeps bundle sizes small while maintaining full control over error formatting and request abort timeouts.

### 2.7 HttpOnly Cookies vs. localStorage for JWT Storage
- **Decision**: Stored access tokens in `HttpOnly` cookies rather than browser `localStorage`.
- **Rationale**: `localStorage` is accessible to any script executing on the origin. A single XSS flaw would allow malicious scripts to extract user JWTs and impersonate sessions. With `HttpOnly: true`, browser JavaScript cannot inspect or exfiltrate tokens.
- **Trade-off**: Requires strict CORS configuration (`credentials: true` and explicit origin matching) and attention to CSRF defense via `SameSite` flags and preflighted headers.

### 2.8 Stateless HttpOnly JWT vs. Database-Backed Refresh Sessions
- **Decision**: Phase 2 uses signed, stateless JWT access tokens in HttpOnly cookies with configurable expiration.
- **Rationale**: Avoids unnecessary complexity and extra database queries on every authenticated request before core project simulation features are built.
- **Future Considerations**: When advanced session features (e.g. "revoke all active devices", "session management") are required, a dedicated `Session` or `RefreshToken` table can be introduced with cryptographic token rotation.

### 2.9 Implicit Ownership Enforcement vs. Client Parameter Trust
- **Decision**: The backend ignores any `ownerId` sent in the request body during workspace creation or updates, deriving identity strictly from the verified JWT token (`req.user.id`).
- **Rationale**: Never trust client inputs for authorization boundaries. Accepting an `ownerId` from the client invites privilege escalation attacks where an authenticated user could create resources under another user's identity.

### 2.10 IDOR Prevention & 404 vs 403 Security Distinction
- **Decision**: Return HTTP 404 Not Found when a workspace ID is either nonexistent or belongs to another user.
- **Rationale**: Returning HTTP 403 Forbidden reveals that a resource *exists* but is forbidden, enabling attackers to systematically brute-force or enumerate valid workspace UUIDs. Returning 404 conceals resource existence entirely.

### 2.11 State Synchronization & Modal UX
- **Decision**: Decouple modal presentation state (`WorkspaceModal`, `DeleteConfirmModal`) from core data state, updating parent component lists reactively upon verified API responses.
- **Rationale**: Ensures the UI remains responsive and resilient to network errors. If a deletion or update fails on the server, the client list is not prematurely mutated, preventing out-of-sync visual artifacts.

### 2.12 Normalized Ownership (No Duplicate `ownerId` on Project)
- **Decision**: `Project` references only `workspaceId`, resolving owner identity via `Workspace.ownerId`.
- **Rationale**: Denormalizing `ownerId` onto `Project` creates duplicate sources of truth. If a workspace were reassigned or ownership updated, child projects could drift into inconsistent states. Normalizing preserves ACID consistency.

### 2.13 Cross-Entity Relational Mutation Enforcing
- **Decision**: Enforce project ownership during mutations via Prisma relation filters: `where: { id, workspace: { ownerId: userId } }`.
- **Rationale**: Eliminates TOCTOU vulnerabilities without requiring extra application-level checks, delegating existence and authorization verification directly to PostgreSQL's query engine.

### 2.14 Control Plane vs. Data Plane Separation
- **Decision**: Separate `/api/v1` (management plane) from `/mock/:projectId/*` (data plane / runtime simulation).
- **Rationale**: Management endpoints require strict JWT authentication, user identity validation, and rate limiting. Mock endpoints represent public simulation targets designed to be called by external third-party services, client frontend prototypes, and test suites without requiring FaultLab authentication cookies or tokens.

### 2.15 Dynamic Route Parameter Matching with Specificity Scoring
- **Decision**: Implement a lightweight, two-pass route matching algorithm that scores candidates by static segment count.
- **Rationale**: Real APIs frequently employ dynamic parameters (e.g. `/users/:id` and `/users/me`). The matching algorithm first attempts an exact match, then evaluates parameterized patterns, awarding higher specificity scores to templates with more literal segments. This ensures `/users/me` takes precedence over `/users/:id` regardless of registration order.

### 2.16 Non-blocking Latency Simulation
- **Decision**: Implement `responseDelay` using non-blocking promise-based `setTimeout`.
- **Rationale**: In Node.js's single-threaded event loop, synchronous delay loops (e.g. `while(Date.now() - start < delay)`) block all incoming network connections. Non-blocking timers release the event loop to continue serving concurrent requests while the delayed request waits.

### 2.17 Compound Uniqueness at the Database Level
- **Decision**: Apply `@@unique([projectId, method, path])` in Prisma schema.
- **Rationale**: Application-level checks cannot prevent race conditions during rapid concurrent requests. A compound uniqueness constraint in PostgreSQL guarantees data consistency and referential integrity under any load.

### 2.18 Co-located Fault Configuration vs. Separate Rules Table
- **Decision**: Extend `MockEndpoint` directly with fault fields rather than a separate `FaultRule` entity.
- **Rationale**: In the high-throughput mock runtime, latency and database query volume must be minimized. Fetching the endpoint and its fault rules in a single indexed query avoids costly SQL joins while maintaining atomic updates during management operations.

### 2.19 Independent Latency vs. Failure Coupling
- **Decision**: Decouple `additionalDelay` from `failureMode`.
- **Rationale**: Real-world services experience high latency without errors (slow responses) as well as errors with high latency (slow timeouts). Allowing additional latency to execute in `NONE`, `ALWAYS`, and `RANDOM` modes gives developers complete freedom to model realistic degraded upstream dependencies.

### 2.20 Non-destructive Fault Disabling
- **Decision**: Provide a `faultEnabled` boolean flag.
- **Rationale**: Disabling chaos testing should never force users to re-enter complex status codes, latency thresholds, and failure payloads. A toggle preserves configuration while allowing instant recovery to normal behavior.

### 2.21 Asynchronous Non-Blocking Request Ingestion
- **Decision**: Trigger request logging asynchronously after dispatching client responses, with localized error trapping (`.catch()`).
- **Rationale**: An observability system must never compromise the performance or stability of the system it observes. Logging asynchronously avoids introducing artificial database latency into simulated responses. If a logging write encounters an error, the error is logged to server diagnostics without interrupting or failing the mock response returned to the client.

### 2.22 Historical Log Retention on Endpoint Lifecycle (`SetNull`)
- **Decision**: Configure `onDelete: SetNull` for `endpointId` in `RequestLog`, while using `onDelete: Cascade` for parent `projectId`.
- **Rationale**: Users frequently adjust or recreate mock endpoints. If logs were cascaded when an individual endpoint is deleted, valuable historical traffic, latency graphs, and failure metrics would disappear. `SetNull` keeps historical telemetry intact while safely disassociating the deleted endpoint reference.

### 2.23 Multi-Column Indexing for Pagination & Aggregation
- **Decision**: Add compound indexes on `[projectId, createdAt(sort: Desc)]`, `[projectId, statusCode]`, and `[projectId, method]`.
- **Rationale**: In relational request history tables with high insert volumes, queries always scope to a specific project while filtering or ordering by timestamp or status. Multi-column indexes eliminate costly sequential table scans, ensuring rapid pagination and real-time metric computations even as log volume scales.

### 2.24 Defense in Depth Against Server-Side Request Forgery (SSRF)
- **Decision**: Validate target schemes (`http:`, `https:` only), pre-resolve DNS hostnames, evaluate against private IPv4/IPv6 and cloud metadata CIDRs using unsigned bitwise arithmetic, and revalidate every redirect hop up to a maximum of 5 hops.
- **Rationale**: Any feature allowing server-initiated outbound HTTP requests is vulnerable to SSRF attacks targeting localhost, internal VPC services, container networks, or cloud instance metadata (`169.254.169.254`). Validating both hostnames and resolved IP addresses prevents DNS rebinding attacks, and revalidating redirects prevents attackers from pivoting to internal resources via 302 redirects.

### 2.25 JavaScript 32-bit Bitwise Operations & Unsigned Shifts (`>>> 0`)
- **Decision**: Use `(num >>> 0)` on all bitwise operations when parsing and checking IPv4 CIDR ranges.
- **Rationale**: JavaScript bitwise operators (`&`, `|`, `^`, `<<`) operate on signed 32-bit integers. Addresses like `192.168.0.0` (`0xC0A80000`) or `172.16.0.0` (`0xAC100000`) have their most significant bit set, making them negative in signed representations. Comparing `(num & 0xffff0000) === 0xc0a80000` evaluates to false unless cast to an unsigned 32-bit integer with `>>> 0`.

### 2.26 Deterministic Safe Assertion Engine Without `eval()`
- **Decision**: Implement JSON path traversal and comparison operators (`EXISTS`, `NOT_EXISTS`, `EQUALS`, `NOT_EQUALS`, `GREATER_THAN`, `LESS_THAN`, `CONTAINS`) using safe object key traversal and strict comparison functions.
- **Rationale**: Using `eval()` or dynamic JavaScript expressions for user-defined assertions introduces Remote Code Execution (RCE) vulnerabilities. Safe path traversal satisfies all assertion use cases without arbitrary code execution risk.

### 2.27 Server-Side Credential Encryption at Rest (AES-256-GCM)
- **Decision**: Encrypt all sensitive API authentication tokens, passwords, and API keys with AES-256-GCM before writing to PostgreSQL, returning only `hasCredentials: boolean` to clients.
- **Rationale**: Credentials stored in plaintext risk exposure through database dumps, rogue log lines, or accidental client responses. Server-side encryption ensures confidentiality, and masking in responses guarantees credentials never leak in the browser.

### 2.28 Deterministic Rule-Based Engine vs. Black-Box AI Models
- **Decision**: Build the API Diagnostic Engine as an explicit, deterministic rule evaluation pipeline across 7 distinct categories rather than relying on an external AI or LLM API.
- **Rationale**: Deterministic rules are instantaneous, reproducible, free of token costs, fully auditable, and cannot hallucinate causes or inaccurate debugging advice. They ground findings directly in empirical evidence (status codes, headers, latency measurements, assertion diffs) with zero external network dependencies.

### 2.29 Non-Blocking Diagnostic Execution & Defensive Boundaries
- **Decision**: Wrap diagnostic generation and database persistence in defensive try/catch blocks within the core API testing pipeline, returning a safe fallback diagnostic report on error.
- **Rationale**: The diagnostic engine is an observational and analytical feature. A diagnostic classification error or database persistence hiccup must never cause an actual HTTP request test to fail, abort, or return an unhandled 500 error to the developer.

### 2.30 Idempotent Atomic Upserting for Diagnostic Reports
- **Decision**: Enforce a `@unique` constraint on `apiTestRunId` in `ApiDiagnosticReport` and use Prisma's `upsert` operation during persistence.
- **Rationale**: Prevents accidental generation of duplicate reports if a run is re-evaluated or referenced multiple times, maintaining a strict 1-to-1 relationship between an execution run and its diagnostic insights.

---

## 3. Strict Boundary Adherence

In accordance with Phase 1 through Phase 8 constraints:
- **No External LLM / AI Dependencies**: Rule evaluation is entirely deterministic, fast, and local.
- **No Redis / Queues / Socket.IO / WebSockets**: Synchronous execution with client polling and responsive React UI provides real-time testing capabilities without distributed complexity.
- **No Docker**: The development setup runs natively on Node.js and Neon PostgreSQL instances.
- **Zero Sensitive Data Storage**: Credentials are encrypted at rest with AES-256-GCM and never returned in plaintext. Outbound response bodies are capped at 2MB to protect server memory.

---

## 4. Implementation Roadmap

- [x] Phase 1: Foundational Architecture & Diagnostics
- [x] Phase 2: Authentication & Authorization (Bcrypt, JWT HttpOnly Cookies, Auth Guard)
- [x] Phase 3A: Workspace Management (CRUD, Ownership Isolation, IDOR Defense, Dashboard UI)
- [x] Phase 3B: Project Management (Relational Modeling, Project CRUD, Workspace Views)
- [x] Phase 4: Mock Endpoint Configuration & Dynamic Response Engine
- [x] Phase 5: Fault Injection Rules & Chaos Simulation
- [x] Phase 6: Request History & Analytics Engine
- [x] Phase 7: Real API Testing Engine (SSRF Guard, Assertions, Encrypted Auth, Test Runs)
- [x] Phase 8: API Diagnostic Engine (Deterministic Rules, Root Cause Analysis, Diagnostics History)
- [ ] Phase 9: Team Collaboration & Workspace Permissions




