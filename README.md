# FaultLab

FaultLab is a scalable API simulation and failure-testing platform for testing distributed system resiliency and chaos scenarios.

This repository implements **Phase 1: Project Initialization & Foundational Architecture**.

---

## Architecture Overview

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS (`/client`)
- **Backend**: Node.js, Express, TypeScript (`/server`)
- **Database**: PostgreSQL with Prisma ORM (`/server/prisma`)
- **Configuration**: Zod validation for runtime environment variables
- **Documentation**: Comprehensive architectural and database guides (`/docs`)

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
- [docs/LEARNING_NOTES.md](docs/LEARNING_NOTES.md) – Architectural decisions, trade-offs, and Phase 2 roadmap

