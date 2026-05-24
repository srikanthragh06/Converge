# Converge — Low-Level Architecture

A technical reference for the Converge codebase. Covers module responsibilities, data flows, key decisions, and implementation details. Written for returning-to-the-project context and interview prep.

---

## Table of Contents

1. [Monorepo & Project Structure](#1-monorepo--project-structure)
2. [Tech Stack](#2-tech-stack)
3. [Database Schema & Migrations](#3-database-schema--migrations)
4. [Authentication](#4-authentication)
5. [Workspace System](#5-workspace-system)
6. [Document CRUD & Lifecycle](#6-document-crud--lifecycle)
7. [Document Access Control](#7-document-access-control)
8. [Yjs Real-time Sync](#8-yjs-real-time-sync)
9. [Presence & Awareness](#9-presence--awareness)
10. [Redis](#10-redis)
11. [API Conventions](#11-api-conventions)
12. [Frontend State — Jotai Atoms](#12-frontend-state--jotai-atoms)
13. [Frontend Routing & Pages](#13-frontend-routing--pages)
14. [Frontend Hooks Inventory](#14-frontend-hooks-inventory)
15. [Socket Client](#15-socket-client)
16. [Editor (BlockNote)](#16-editor-blocknote)
17. [`@converge/shared`](#17-converge-shared)
18. [Deployment](#18-deployment)

---

## 1. Monorepo & Project Structure

### What is pnpm

pnpm is a package manager like npm or yarn. When you run `npm install`, npm downloads packages into a `node_modules` folder inside your project — every project gets its own copy. If you have 10 projects using React, you have 10 copies of React on your machine. pnpm does it differently. It downloads packages into one central folder on your machine and in your project's `node_modules` it just creates a shortcut pointing to that central copy. So React is only ever stored once no matter how many projects use it. pnpm also has built-in support for repos like ours where multiple packages live together — `pnpm install` at the root installs dependencies for all three packages at once, and `--filter` lets you run a script in just one of them.

### Why a monorepo

Converge uses a monorepo primarily to share types across the frontend and backend. Socket event payloads and HTTP request/response shapes are defined once in `@converge/shared` and consumed by both `apps/web` and `apps/server`. This means when you add a new endpoint or socket event, you define the type in one place and TypeScript enforces it on both sides. No duplication, no drift between what the server sends and what the client expects.

### Structure

pnpm workspace monorepo. `pnpm-workspace.yaml` registers `apps/*` and `packages/*` — three packages:

| Package           | Name               | Purpose                                     |
| ----------------- | ------------------ | ------------------------------------------- |
| `apps/web`        | `web`              | React + Vite frontend                       |
| `apps/server`     | `server`           | NestJS + Socket.io backend                  |
| `packages/shared` | `@converge/shared` | Shared types, schemas, constants, utilities |

```
├── apps/
│   ├── web/
│   └── server/
├── packages/
│   └── shared/
├── deploy/               # deploy.py + .env.example
├── nginx/                # prod nginx site config
├── tmux/                 # setup.sh — launches the dev environment
├── docs/                 # architecture docs
├── docker-compose.dev.yml
├── docker-compose.blue.yml    # prod blue slot (ports 5001–5003)
├── docker-compose.green.yml   # prod green slot (ports 5004–5006)
├── pnpm-workspace.yaml
├── CLAUDE.md
├── ROADMAP.md
└── schema.md             # DB + Redis schema reference
```

### How pnpm workspaces work

pnpm maintains a single lockfile at the repo root covering all three packages. This means `web` and `server` can never accidentally end up on different versions of the same dependency.

pnpm keeps a global store on your machine at `~/.local/share/pnpm/store`. It is pnpm's central library of every package it has ever downloaded across all projects on your machine. When you install a package for the first time, pnpm downloads it into the store. The next time any project needs the same package at the same version, pnpm skips the download and uses what is already there.

It then hard links files from that store into `node_modules/.pnpm` inside your project. A hard link means two names pointing to the exact same bytes on disk — no copying, no duplication. From there, each app's `node_modules` contains symlinks pointing at the corresponding entry in `.pnpm`. A symlink is just a pointer to another location. So the full chain is:

```
apps/web/node_modules/react          (symlink)
  → node_modules/.pnpm/react@19.2.4  (hard link)
    → ~/.local/share/pnpm/store/v10   (real bytes, stored once)
```

`workspace:*` in a `package.json` dependency tells pnpm to link the local package directly instead of fetching from npm. So `apps/server/node_modules/@converge/shared` is a symlink pointing at `packages/shared` on your machine. Any change you make in `packages/shared/src` is immediately available in `server` and `web` without reinstalling anything. Note: you must use `pnpm` to run scripts, not `npm` — npm does not understand the `workspace:` protocol and would try to fetch `@converge/shared` from the npm registry.

`--filter` runs a script in a specific package:

```bash
pnpm --filter web dev
pnpm --filter server start:dev
pnpm --filter @converge/shared build
```

### Build order

`@converge/shared` must compile before either app — both import from it and need the compiled `dist/` output. Root `build` script enforces the order:

```bash
pnpm --filter @converge/shared build && pnpm --filter web build && pnpm --filter server build
```

In Docker, `build:watch` runs inside the container to keep compiled output in sync with source changes during development.

### Engine constraints

```json
"engines": { "node": ">=20", "pnpm": ">=10" },
"pnpm": { "engineStrict": true }
```

`engineStrict: true` — pnpm refuses to install if versions don't match.

---

### Dev environment

**Option 1 — tmux script (recommended)**

```bash
bash tmux/setup.sh
```

Starts all Docker containers via `docker-compose.dev.yml`, then opens a tmux session with two windows:

- `infra` — shell pane + `psql` pane connected to the local Postgres container
- `logs` — `docker logs -f` for `server-1` and `web-1`

**Option 2 — direct pnpm commands (no Docker)**

```bash
pnpm --filter server start:dev   # NestJS with --watch (ts-node hot reload)
pnpm --filter web dev            # Vite dev server
```

Requires Postgres and Redis running separately.

**What `docker-compose.dev.yml` runs**

Two server instances + two web instances — intentional, for testing multi-server real-time sync locally without a staging environment:

| Service    | Host port | Notes                                     |
| ---------- | --------- | ----------------------------------------- |
| `postgres` | 5432      | Postgres 16, named volume for persistence |
| `redis`    | 6379      | Redis 7 Alpine                            |
| `server-1` | 5000      | `CLIENT_URL=http://localhost:5173`        |
| `server-2` | 5001      | `CLIENT_URL=http://localhost:5174`        |
| `web-1`    | 5173      | `VITE_SERVER_URL=http://localhost:5000`   |
| `web-2`    | 5174      | `VITE_SERVER_URL=http://localhost:5001`   |

Source dirs (`apps/server/src`, `apps/web/src`, `packages/shared/src`) are bind-mounted so hot reload works without rebuilding images.

**Vite-specific dev config** (`apps/web/vite.config.ts`)

- `server.host: true` — binds to `0.0.0.0`, reachable from outside the container
- `server.port` — reads `PORT` env var, falls back to `5173`; allows multiple web instances from the same image
- `hmr.clientPort` — mirrors `PORT` so the browser connects HMR to the correct host port when inside Docker
- `optimizeDeps.include: ["@converge/shared"]` — forces Vite to pre-bundle the local workspace package; without this Vite skips CJS→ESM conversion for workspace packages and imports break

---

### Prod environment

Frontend is a static build (`tsc + vite build`) served directly by nginx — no Vite in prod. Only the server runs in Docker.

Three server instances per slot (blue or green). Each compose file has an explicit `name:` field (`converge-blue` / `converge-green`) so Docker treats them as independent projects even though they share the same directory.

Postgres and Redis are external — Supabase and Upstash respectively. Not defined in the compose files; connection URLs are injected via `apps/server/.env` at runtime.

**Env config** (`apps/server/src/utils/env.loader.ts`)

Called at the very top of `main.ts` before `NestFactory.create`:

```
.env.<NODE_ENV>  →  loaded first, takes precedence
.env             →  loaded second, shared fallback (dotenv never overwrites existing keys)
```

`NODE_ENV` defaults to `'dev'`. Prod containers set `NODE_ENV: prod` in the compose file, so `.env.prod` loads. `ConfigModule` in `AppModule` mirrors this exact pattern for NestJS's DI system.

---

### Server startup sequence (`main.ts`)

Order matters — each step must complete before the next:

1. `loadEnv()` — populates `process.env` before any module constructor runs
2. `registerProcessHandlers()` — attaches process-level error handlers:
    - `unhandledRejection` → log and continue
    - `uncaughtException` → log and `process.exit(1)`, let the process manager restart
3. `NestFactory.create(AppModule)` — builds the DI container
4. Wire CORS (`CLIENT_URL`, `credentials: true`), Socket.io adapter, `GlobalExceptionFilter`, `cookie-parser`
5. `verifyDBConnection()` → `migrate()` — blocks until Postgres is reachable, runs all pending migrations
6. `verifyRedisConnection()` — blocks until Redis is reachable
7. `app.listen(PORT)`

Steps 5–6 ensure the server never accepts traffic with a broken infra connection or a stale schema.

---

## 2. Tech Stack

---

## 3. Database Schema & Migrations

---

## 4. Authentication

---

## 5. Workspace System

---

## 6. Document CRUD & Lifecycle

---

## 7. Document Access Control

---

## 8. Yjs Real-time Sync

---

## 9. Presence & Awareness

---

## 10. Redis

---

## 11. API Conventions

---

## 12. Frontend State — Jotai Atoms

---

## 13. Frontend Routing & Pages

---

## 14. Frontend Hooks Inventory

---

## 15. Socket Client

---

## 16. Editor (BlockNote)

---

## 17. `@converge/shared`

---

## 18. Deployment

---
