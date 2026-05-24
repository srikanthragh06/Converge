# Converge — Low-Level Architecture

A technical reference for the Converge codebase. Covers module responsibilities, data flows, key decisions, and implementation details. Written for returning-to-the-project context.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Monorepo & Project Structure](#2-monorepo--project-structure)
3. [NestJS Server](#3-nestjs-server)
4. [Database Schema & Migrations](#4-database-schema--migrations)
5. [Authentication](#5-authentication)
6. [Workspace System](#6-workspace-system)
7. [Document CRUD & Lifecycle](#7-document-crud--lifecycle)
8. [Document Access Control](#8-document-access-control)
9. [Yjs Real-time Sync](#9-yjs-real-time-sync)
10. [Presence & Awareness](#10-presence--awareness)
11. [Redis](#11-redis)
12. [API Conventions](#12-api-conventions)
13. [Frontend State — Jotai Atoms](#13-frontend-state--jotai-atoms)
14. [Frontend Routing & Pages](#14-frontend-routing--pages)
15. [Frontend Hooks Inventory](#15-frontend-hooks-inventory)
16. [Socket Client](#16-socket-client)
17. [Editor (BlockNote)](#17-editor-blocknote)
18. [`@converge/shared`](#18-converge-shared)
19. [Deployment](#19-deployment)

---

## 1. Tech Stack

### Frontend (`apps/web`)

| Package | Version | Role |
|---|---|---|
| React | 19 | UI framework |
| Vite | 8 | Dev server and build tool — handles TypeScript compilation (not `tsc`), HMR, and bundling |
| TypeScript | 5.9 | Type safety — `noEmit: true` so Vite compiles, `tsc` only type-checks |
| Tailwind CSS | v3 | Utility-first styling. v3 not v4 — BlockNote ships CSS that breaks under v4's engine |
| Mantine | 8 | Component library. Used directly for some UI and pulled in transitively by BlockNote |
| BlockNote | 0.45 | Block-style rich text editor built on ProseMirror + Tiptap. Custom extensions live in `apps/web/src/lib/` |
| Jotai | 2 | Global client state via atoms. Preferred over React context for cross-hook state |
| React Router | v7 | Client-side routing |
| Socket.io-client | 4 | WebSocket connection to the server |
| Yjs + y-prosemirror | — | Client-side CRDT. `yjs` holds the shared document state, `y-prosemirror` binds it to BlockNote's ProseMirror editor |
| Axios | 1 | HTTP client for REST calls |
| Zod | 4 | Schema validation — shared types come from `@converge/shared`, Zod validates them on both sides |
| Lucide React / React Icons / PrimeIcons | — | Icon sets used across UI components |

### Backend (`apps/server`)

| Package | Version | Role |
|---|---|---|
| NestJS | 11 | Framework — modules, dependency injection, decorators, controllers, guards, filters |
| Socket.io | 4 | WebSocket server. NestJS wraps it via `@nestjs/platform-socket.io` and `@nestjs/websockets` |
| Kysely | 0.28 | SQL query builder. Typed but not an ORM — you write SQL-shaped code, no magic. Table types defined in `db/database.schema.ts` |
| PostgreSQL (via `pg`) | 16 | Primary database |
| Redis (via ioredis) | 7 | Two roles: pub/sub for cross-server Yjs sync, and throttler storage so rate limit counters are shared across server instances |
| Yjs | 13 | Server-side CRDT state. Each active document has a `Y.Doc` in memory; Yjs applies and merges client updates |
| jsonwebtoken | 9 | Signs and verifies JWTs for auth |
| Zod | 4 | Server-side request validation via `ZodHttpValidationPipe` |
| `@nestjs/throttler` + `@nest-lab/throttler-storage-redis` | — | Per-user rate limiting. Throttler state stored in Redis so limits are enforced across all server instances |
| `@nestjs/config` | 4 | Environment config — reads `.env.<NODE_ENV>` with `.env` as fallback |

### Shared (`packages/shared`)

| Package | Role |
|---|---|
| Zod | Defines socket event payload schemas and HTTP request/response schemas consumed by both `web` and `server` |

### Infrastructure

| Tool | Role |
|---|---|
| Docker + docker-compose | Dev: 6-container setup (postgres, redis, 2× server, 2× web). Prod: blue/green deployment slots |
| PostgreSQL 16 | Primary database |
| Redis 7 | Pub/sub + throttler storage |
| nginx | Prod reverse proxy — routes traffic to the active blue or green slot |

---

## 2. Monorepo & Project Structure

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

`@converge/shared` must be built before `web` and `server`. When either app imports from `@converge/shared`, Node follows the symlink to `packages/shared` and reads the `main` field in its `package.json` which points to `dist/index.js`. So if `dist/` does not exist yet, the import fails even though the symlink is there.

The root `build` script enforces the order:

```bash
pnpm --filter @converge/shared build && pnpm --filter web build && pnpm --filter server build
```

In Docker dev, `build:watch` runs inside the container. It runs `tsc --watch` which sits in the background and recompiles `packages/shared/src` into `dist/` every time you save a file. So any change to shared is immediately compiled and available to `web` and `server` without manually running the build.

### Engine constraints

```json
"engines": { "node": ">=20", "pnpm": ">=10" },
"pnpm": { "engineStrict": true }
```

`engineStrict: true` — pnpm refuses to install if versions don't match.

---

### `packages/shared` — package.json & tsconfig

**`package.json`**

- `name: "@converge/shared"` — the `@converge/` scope groups it under the project namespace and makes clear it is internal. This is what `workspace:*` matches against and what you use with `--filter`
- `private: true` — prevents accidentally publishing to npm
- `main: "dist/index.js"` — fallback for older Node versions that don't understand the `exports` field. When Node resolves `import from '@converge/shared'` it reads this to find the JavaScript
- `types: "dist/index.d.ts"` — fallback for older TypeScript versions that don't understand `exports`. When TypeScript resolves the import it reads this to find the type declarations
- `exports` — the modern way to define entry points, takes precedence over `main` in Node 12+. Has both `require` and `default` pointing to the same file for CJS/ESM compatibility. Also has `types` so modern TypeScript finds declarations through `exports` instead of the top level `types` field

**`tsconfig.json`**

- `strict: true` — full strict mode, catches more bugs at compile time
- `target: "ES2020"` — tells TypeScript what JavaScript version to output. ES2020 is supported by Node 14+ natively without needing polyfills. If your code uses newer syntax, TypeScript rewrites it to an ES2020 equivalent
- `lib: ["ES2020"]` — tells TypeScript what built-in APIs you are allowed to use. `ES2020` includes things like `Promise`, `Map`, `Set` — language features available in both Node and browsers. No `DOM` here because shared should never depend on browser-only APIs like `document` or `window`
- `module: "Node16"` — tells TypeScript what module system to output. `Node16` means output code that works with Node's hybrid system which supports both CommonJS and ESM
- `moduleResolution: "node16"` — the algorithm TypeScript uses to find files when it sees an import. `node16` means it respects the `exports` field in `package.json`. Without this TypeScript uses an older algorithm that ignores `exports` and only reads `main`
- `rootDir: "src"` — only files inside `src/` get compiled, prevents config files or anything at the root being accidentally included
- `outDir: "dist"` — compiled output goes to `dist/`
- `declaration: true` — generates `.d.ts` files alongside the `.js` files. Without this, consumers get no type information when importing from shared
- `declarationMap: true` — generates `.d.ts.map` files. Without this, cmd+click on a shared type takes you to the unreadable compiled `.d.ts`. With it, your editor jumps to the original `.ts` source
- no `noEmit` — if this were set, `dist/` would never be created and imports would fail
- `skipLibCheck: true` — skips type checking `.d.ts` files in `node_modules`, avoids errors from third-party packages with incorrect types

---

### `apps/server` — tsconfig.json & nest-cli.json

**`tsconfig.json`**

- `strict: true` — full strict mode, catches more bugs at compile time
- `target: "ES2023"` — outputs modern JavaScript, Node 18+ supports it natively
- `module: "nodenext"`, `moduleResolution: "nodenext"` — same as shared's `node16` but the latest version. Tells TypeScript to output code compatible with Node's module system and resolve imports the way Node does
- `resolvePackageJsonExports: true` — when TypeScript resolves an import like `@converge/shared`, it reads the `exports` field in that package's `package.json` to find the correct entry point file rather than guessing or falling back to older fields
- `esModuleInterop: true` — allows importing CommonJS packages with `import x from 'x'` instead of `import * as x from 'x'`. Many older npm packages are CommonJS so this makes imports cleaner
- `emitDecoratorMetadata: true`, `experimentalDecorators: true` — required for NestJS. Decorators like `@Module`, `@Injectable`, `@Controller` do not work without these
- `rootDir: "./src"`, `outDir: "./dist"` — source lives in `src/`, compiled output goes to `dist/`
- `declaration: true` — generates `.d.ts` files alongside compiled output
- `removeComments: true` — strips comments from compiled output to reduce file size
- `sourceMap: true` — generates `.js.map` files so stack traces in production point to the original TypeScript line instead of compiled JavaScript
- `incremental: false` — disables incremental compilation. NestJS CLI handles its own build caching so this is not needed
- `types: ["node"]` — only Node.js types available, no DOM APIs
- `isolatedModules: true` — each file must be independently compilable without needing information from other files
- `forceConsistentCasingInFileNames: true` — prevents import casing mismatches between operating systems. Mac is case-insensitive, Linux is not — this catches those bugs at compile time
- `skipLibCheck: true` — skips type checking `.d.ts` files in `node_modules`

**`nest-cli.json`**

- `deleteOutDir: true` — wipes `dist/` on every build so no stale compiled files accumulate

---

### `apps/web` — notable tsconfig points

- `noEmit: true` — TypeScript only type-checks, Vite does the actual compilation. Unlike server and shared which compile themselves
- `moduleResolution: "bundler"` — tells TypeScript that Vite handles module resolution, not Node
- `lib: ["ES2023", "DOM", "DOM.Iterable"]` — includes DOM because React code runs in the browser. Server and shared do not have this
- Two separate tsconfig files — `tsconfig.app.json` for React source code, `tsconfig.node.json` for `vite.config.ts`. Kept separate because `vite.config.ts` runs in Node so it should not have DOM types
- `paths: { "@/*": ["./src/*"] }` — `@/` alias so you can do `import x from '@/components/...'` instead of relative paths

> **Note:** When you make changes to `packages/shared`, the web dev container must be restarted to pick them up. Vite pre-bundles `@converge/shared` into its cache at startup via `optimizeDeps.include` and reads from that cache at runtime — not from the live files. Restarting forces Vite to re-bundle from scratch.

---

### Dev setup

**`docker-compose.dev.yml`**

Defines 6 containers that run together:

| Service | Port | Notes |
|---|---|---|
| `postgres` | 5432 | Postgres 16, named volume for data persistence |
| `redis` | 6379 | Redis 7 Alpine |
| `server-1` | 5000 | Points at `web-1` via `CLIENT_URL` |
| `server-2` | 5001 | Points at `web-2` via `CLIENT_URL` |
| `web-1` | 5173 | `VITE_SERVER_URL=http://localhost:5000` |
| `web-2` | 5174 | `VITE_SERVER_URL=http://localhost:5001` |

Two server instances and two web instances are intentional — lets you test multi-server real-time sync locally without a staging environment.

Postgres and Redis use official Docker Hub images. Server and web are built from their own Dockerfiles. `context: .` gives the build access to the entire repo root since the Dockerfiles copy files from `packages/shared/` as well.

Inside Docker, containers talk to each other by service name not `localhost`. So the server connects to Postgres at hostname `postgres` and Redis at hostname `redis`. `depends_on` ensures Postgres and Redis start before the servers, and servers start before the web instances.

**Bind mounts**

```yaml
- ./apps/server/src:/app/apps/server/src
- ./packages/shared/src:/app/packages/shared/src
- ./packages/shared/dist:/app/packages/shared/dist
```

When Docker builds the image it bakes a copy of the source into it. Without bind mounts, every code change would require a full image rebuild. Bind mounts replace the baked copy with your actual local folder — so edits on your machine appear inside the container instantly and NestJS `--watch` or Vite picks them up automatically.

`node_modules` is deliberately not mounted — it stays as the copy built inside the image. Mounting it would break pnpm's symlinks since the paths inside the container differ from your machine. This also means if you install a new package, you need to rebuild the image with `docker compose up --build` so `pnpm install` runs again inside the container.

`packages/shared/dist` is mounted so that when `build:watch` recompiles shared inside the container, the output also appears on your machine. This keeps your local VS Code types in sync without any manual steps.

### Dockerfiles (dev)

Both `apps/server/Dockerfile` and `apps/web/Dockerfile` are identical in structure — the only difference is the final command (`start:dev` vs `dev`).

**`FROM node:20-alpine AS dev`**
Starts from the official Node 20 Alpine image. Alpine is a lightweight Linux distro — much smaller than the default Ubuntu-based Node image.

**`corepack enable && corepack prepare pnpm@10.33.0 --activate`**
Corepack ships with Node and manages package manager versions. This ensures the container uses exactly `pnpm@10.33.0` — the same version declared in the root `package.json` — rather than whatever version happens to be installed on the base image.

**Layer caching strategy**
```dockerfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ ./packages/shared/
COPY apps/server/ ./apps/server/
```
Manifests are copied first, then `pnpm install`, then source. Docker caches each step as a layer. Since dependencies rarely change, the install layer gets cached and only reruns when a `package.json` or lockfile changes. If source was copied first, any code change would bust the install cache and reinstall everything every time.

`--frozen-lockfile` tells pnpm to install exactly what is in `pnpm-lock.yaml` and fail if there is any mismatch — prevents the container from silently installing different versions than what is in the lockfile.

**`RUN pnpm --filter @converge/shared build`**
Compiles shared once during image build so `dist/` exists when the container starts. Without this the server or Vite would fail to import from `@converge/shared` on first boot.

**`CMD`**
```dockerfile
CMD ["sh", "-c", "pnpm --filter @converge/shared build:watch & pnpm --filter server start:dev"]
```
`sh -c` lets you run a full shell string so multiple processes can be started together. `build:watch` runs in the background (`&`) keeping shared compiled on every save. `start:dev` runs in the foreground with NestJS hot reload. Together they give hot reload on both app code and shared changes.

---

## 3. NestJS Server

### Entry point — `main.ts`

`bootstrap()` wires up the app in this order:

1. `loadEnv()` — reads `.env.<NODE_ENV>` and `.env` into `process.env` before any module constructor runs
2. `registerProcessHandlers()` — attaches `unhandledRejection` and `uncaughtException` handlers
3. `NestFactory.create(AppModule)` — builds the DI container from the root module
4. `app.enableCors(...)` — restricts origins to `CLIENT_URL`, `credentials: true` so the browser accepts `Set-Cookie` on cross-origin responses
5. `app.useWebSocketAdapter(new IoAdapter(app))` — attaches Socket.io to the same HTTP server so REST and WebSocket share one port
6. `app.useGlobalFilters(new GlobalExceptionFilter())` — catches all unhandled exceptions in the NestJS pipeline
7. `app.use(cookieParser())` — parses `Cookie` headers into `req.cookies`
8. `dbService.verifyDBConnection()` then `dbService.migrate()` — confirms Postgres is reachable and runs pending migrations before accepting traffic
9. `redisService.verifyRedisConnection()` — confirms Redis is reachable
10. `app.listen(PORT)`

### Module system

A NestJS module is a class decorated with `@Module({})`. It is the unit of organisation — it declares what a feature provides and what it needs.

```
@Module({
  imports: [DatabaseModule, RedisModule, AuthModule],  // modules this module depends on
  providers: [DocumentService, DocumentYjsService],    // services registered in the DI container
  controllers: [DocumentController],                   // HTTP route handlers
  exports: [],                                         // what this module exposes to other modules
})
export class DocumentModule {}
```

`AppModule` is the root — all feature modules are imported there. Feature modules: `DocumentModule`, `WorkspaceModule`, `AuthModule`, `DatabaseModule`, `RedisModule`.

`imports` — to use `DatabaseService` inside `DocumentModule`, you import `DatabaseModule` (which exports `DatabaseService`). NestJS resolves the dependency — you never call `new DatabaseService()`. If `DatabaseModule` is not in `imports`, injecting `DatabaseService` throws at startup.

`exports` — a provider is only injectable in modules that import the module that exports it. `DatabaseModule` exports `DatabaseService`; any module that imports `DatabaseModule` can inject it.

### Layered architecture

```
HTTP request → Controller → Service → (DatabaseService / RedisService)
WebSocket event → Gateway → Service → (DatabaseService / RedisService)
```

Controllers and gateways handle routing and input parsing. Services hold all business logic. There is no separate repository layer — database calls live in services directly.

### Request pipeline

Every incoming HTTP request passes through this chain in order:

```
Guard → Pipe → Handler → Exception Filter
```

- **Guards** — run before the handler. Return `true` to allow, `false` to block. `AuthGuard` reads the JWT cookie and stamps `userId` on the request. `UserThrottlerGuard` keys rate limits on `userId` (not IP) using Redis-backed counters.
- **Pipes** — transform or validate input. `ParseIntPipe` coerces string route params to numbers. `ZodHttpValidationPipe` validates `@Body()` against a Zod schema and throws a 400 if it fails.
- **Exception filter** — `GlobalExceptionFilter` is registered globally. Catches any exception that escapes the handler and returns a structured error response for HTTP or emits on the `"error"` channel for WebSocket.

### Dependency injection

`@Injectable()` marks a class as a DI-managed provider. NestJS reads the constructor signature and resolves each parameter from the container automatically.

```typescript
@Injectable()
export class DocumentService {
  constructor(
    private readonly db: DatabaseService,     // NestJS injects this
    private readonly redis: RedisService,     // and this
  ) {}
}
```

You never instantiate services yourself. If a dependency is missing from the module graph, NestJS throws at startup — not at runtime.

### Socket.io setup

**`IoAdapter`** — registered in `main.ts`. Attaches the Socket.io server to the same underlying HTTP server that NestJS uses for REST. Both share one port.

**`@WebSocketGateway`** — decorator that registers a class as a Socket.io handler. CORS is passed as a function so `CLIENT_URL` is read at connection time rather than at startup:

```typescript
@WebSocketGateway({
  cors: {
    origin: (_req, cb) => cb(null, process.env.CLIENT_URL),
    credentials: true,
  },
})
```

**`@WebSocketServer()`** — field decorator that injects the live Socket.io `Server` instance into the gateway class, used for broadcasting to rooms.

**`@SubscribeMessage(SOCKET_EVENTS.X)`** — registers a method as the handler for a specific socket event. The WebSocket equivalent of `@Get` / `@Post`.

**`OnGatewayConnection` / `OnGatewayDisconnect`** — interfaces the gateway implements. `handleConnection(client)` fires on every new socket. `handleDisconnect(client)` fires when a socket drops. All per-socket setup and teardown lives here.

**`@UseFilters(GlobalExceptionFilter)`** on the gateway class — overrides NestJS's default WebSocket exception handler so errors are emitted on the `"error"` channel instead of the default `"exception"` channel.

---

## 4. Database Schema & Migrations

---

## 5. Authentication

---

## 6. Workspace System

---

## 7. Document CRUD & Lifecycle

---

## 8. Document Access Control

---

## 9. Yjs Real-time Sync

---

## 10. Presence & Awareness

---

## 11. Redis

---

## 12. API Conventions

---

## 13. Frontend State — Jotai Atoms

---

## 14. Frontend Routing & Pages

---

## 15. Frontend Hooks Inventory

---

## 16. Socket Client

---

## 17. Editor (BlockNote)

---

## 18. `@converge/shared`

---

## 19. Deployment

---
