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

---

## 3. Strict Boundary Adherence

In accordance with Phase 1 constraints:
- **No Redis / Queues / Socket.IO**: Premature distributed dependencies were avoided until the core data modeling and authentication layers are settled.
- **No Docker**: The development setup runs natively on Node.js and standard PostgreSQL instances.
- **No Premature Business Logic**: The Prisma models define only `User` and `Workspace` structures without mock authentication endpoints or incomplete CRUD handlers.

---

## 4. Phase 2 Readiness Checklist

Phase 1 provides clean entry points for Phase 2 implementation:
- [ ] Authentication Module (JWT / Session handling, bcrypt password hashing).
- [ ] User registration, login, and workspace context switcher.
- [ ] Project and mock endpoint management modules.
- [ ] Request interception and dynamic response generation.

