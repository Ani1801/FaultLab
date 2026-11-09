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
│   │   └── schema.prisma       # Prisma ORM schema & data models
│   ├── src/
│   │   ├── config/             # Zod environment variable parsing & schema
│   │   ├── middleware/         # Centralized error handler, request logger, 404 handler
│   │   ├── modules/            # Feature modules (Health, and future modules)
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
5. The frontend displays the real status without artificial mocks or hardcoded success states.

