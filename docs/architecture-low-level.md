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

## 4. Kysely

Kysely is a type-safe SQL query builder — not an ORM. There are no models, no magic, no lazy loading. You write SQL-shaped TypeScript and Kysely compiles it to a query. Wrong column names and wrong value types are compile errors.

### Connection pooling

`DatabaseService` creates a `pg.Pool` and hands it to Kysely via `PostgresDialect`. The pool maintains persistent Postgres connections and reuses them across queries — no new TCP connection per request.

Pool config differs by environment:

- **DEV** — connects to the `postgres` container from `docker-compose.dev.yml` using host/port/user/password from `.env.dev`
- **PROD** — connects to Supabase with `ssl: { rejectUnauthorized: false }`. Supabase's certificate chain is not trusted by Node's default CA bundle so CA verification is skipped. The connection is still TLS-encrypted.

### BIGINT parsing

By default `pg` returns `BIGINT` columns (OID 20) as JavaScript strings. `DatabaseService` overrides this once at construction time:

```typescript
types.setTypeParser(20, (val: string) => Number(val));
```

Without this, `bigserial` ID columns come back as `"123"` instead of `123` and break comparisons and JSON serialisation.

### Type integration

`database.schema.ts` defines a TypeScript interface per table. `Generated<T>` marks columns Postgres fills in automatically (PKs, `created_at`, columns with defaults) — Kysely's insert types exclude them so you never have to provide them manually. Enum columns like `DocumentAccessLevel` and `WorkspaceRole` use the shared types imported from `@converge/shared`.

All interfaces are collected into `DatabaseSchema`, which is passed as a generic to the Kysely instance:

```typescript
this.kysely = new Kysely<DatabaseSchema>({
  dialect: new PostgresDialect({ pool: this.pool }),
});
```

`DatabaseService` exposes `kysely` as a public field. Services inject `DatabaseService` and pull the instance out locally:

```typescript
const db = this.dbService.kysely;
await db.selectFrom('documents').where('id', '=', documentId).selectAll().executeTakeFirst();
```

`DatabaseModule` provides and exports `DatabaseService`. Any feature module that needs database access imports `DatabaseModule`.

### Migrations

Migration files live in `apps/server/src/migrations/`, named `<number>_<purpose>.ts`. Each exports `up` and `down`:

```typescript
export async function up(db: Kysely<unknown>): Promise<void> { ... }
export async function down(db: Kysely<unknown>): Promise<void> { ... }
```

Migrations use `Kysely<unknown>` — not `Kysely<DatabaseSchema>` — because the schema type at the time each migration runs may not match the final shape.

`DatabaseService.migrate()` is called in `main.ts` on every startup before the server accepts traffic. Kysely tracks applied migrations in a `kysely_migration` table it manages internally. `migrateToLatest()` runs only the files not yet applied. If any migration fails the server throws and refuses to start.

---

## 5. Authentication

### Google OAuth — how it works

Converge uses Google OAuth with the **authorization code flow**. Here is the high-level sequence:

1. The frontend redirects the user to Google's login page, including the app's **client ID** in the URL
2. The user logs in and consents
3. Google redirects back to the app with a short-lived one-time `code` in the URL
4. The **server** POSTs that `code` to Google's token endpoint along with the **client secret** — this exchange happens server-to-server so the secret never touches the browser
5. Google verifies the secret and returns an ID token — a signed JWT containing the user's profile (`sub`, `email`, `name`, `picture`)
6. The server decodes the ID token, upserts the user in the DB, and issues its own session token (another JWT) as a cookie

**Client ID** — a public identifier for the app. Included in the frontend redirect URL so Google knows which app is requesting login. Safe to expose.

**Client Secret** — proves to Google that the code exchange is coming from the legitimate server, not someone who intercepted the `code` from the redirect URL. Never sent to the browser. Lives in `.env`.

Both are registered on Google Cloud Console when setting up the OAuth app. Allowed redirect URIs are also registered there — Google only sends the user back to pre-approved URLs.

**CSRF state token** — a random value the frontend generates before the redirect and stores in `localStorage`. Google echoes it back in the callback URL. The frontend validates it matches before exchanging the code. Prevents an attacker from tricking you into completing *their* OAuth flow — without it, they could craft a callback URL and get you logged into their account. For a login-only app like Converge this is low-stakes, but it matters in flows where completing the OAuth grants the attacker something (e.g. linking your payment method to their account).

### Implementation

#### Frontend flow

`AuthPage` handles the initial redirect. When the user clicks "Sign in with Google":
1. Generates a random CSRF state token using `crypto.getRandomValues` — cryptographically random, not `Math.random()`
2. Stores it in `localStorage` under `AUTH_CSRF_STATE`
3. Builds the Google OAuth URL with `client_id` (from `VITE_GOOGLE_CLIENT_ID`), `redirect_uri` (`/auth/callback`), `response_type: code`, `scope: openid email profile`, and `state`
4. Redirects the browser via `window.location.assign`

When Google redirects back to `/auth/callback`, `AuthCallbackPage` mounts and `useGoogleAuthCallback` runs:
1. Reads `code` and `state` from the URL query params
2. Reads the original state from `localStorage` and compares — throws if they don't match
3. Removes the state from `localStorage` immediately — it is single-use
4. POSTs `{ code }` to `POST /auth/google`
5. On success: sets `authAtom` to `authenticated` with the returned user profile, then navigates to `/` after a 1.2s delay so the success message is briefly visible
6. On failure: sets `authAtom` to `unauthenticated`

#### Backend flow — `POST /auth/google`

The server POSTs to `https://oauth2.googleapis.com/token` with `code`, `client_id`, `client_secret`, `redirect_uri`, and `grant_type: authorization_code`. Google returns an `id_token`.

The server decodes the ID token with `jwt.decode` — not `jwt.verify`. There is no signature verification because we are trusting Google's HTTPS endpoint for authenticity. If we got a response from that endpoint, Google issued the token. `jwt.decode` just reads the payload: `sub` (stable Google user ID), `email`, `name`, `picture`.

The user is then upserted into the DB keyed on `google_id` (`sub`), not `email`. Emails can change on Google's side — keying on `email` would create a duplicate row every time someone changes their Google email. `google_id` is stable for the lifetime of the account. On conflict, the upsert updates `email`, `name`, and `avatar_url` to stay in sync with Google.

On first signup, a personal workspace is created for the user. Subsequent logins are a no-op for the workspace.

#### The JWT we issue

After upsert, the server signs its own JWT with `jsonwebtoken`:

```typescript
jwt.sign({ userId: userId.toString(), userEmail }, secret, { expiresIn: 60 * 60 * 24 * 7 });
```

`userId` is serialised as a string in the payload for consistent type handling across all consumers — numeric JWT claims can behave inconsistently across libraries. The JWT expires in 7 days.

`verifyAuthToken` (used by both `AuthGuard` and the WebSocket gateway) does two things:
1. `jwt.verify(authToken, secret)` — checks the signature and expiry. Throws if tampered or expired.
2. DB lookup — confirms the user still exists. Catches the case where a valid JWT belongs to a deleted account.

Only after both pass is the `userId` returned and stamped onto the request.

#### Cookie config

The JWT is sent to the client as an `httpOnly` cookie:

```typescript
res.cookie('authToken', token, {
  httpOnly: true,
  sameSite: 'strict',
  secure: environment === 'PROD',
  maxAge: 60 * 60 * 24 * 7 * 1000,
});
```

- `httpOnly` — the cookie is invisible to JavaScript (`document.cookie`). Prevents XSS attacks from stealing the token — even if an attacker injects a script, they cannot read the cookie
- `SameSite: strict` — the browser will not send the cookie on any cross-site request, including navigations from other sites. Prevents CSRF on the API
- `secure` — only sent over HTTPS. Disabled in dev since the local environment runs on HTTP
- `maxAge` matches the JWT's own expiry so the cookie and token expire together

#### `AuthGuard`

`AuthGuard` implements NestJS's `CanActivate` interface. NestJS calls `canActivate()` before the route handler — if it returns `true` the request proceeds, if it throws the request is rejected.

```typescript
async canActivate(context: ExecutionContext): Promise<boolean> {
  const request = context.switchToHttp().getRequest();
  await this.authService.verifyReqAuthAndAttachUserToReq(request);
  return true;
}
```

It throws `UnauthorizedException` on any failure rather than returning `false`. Returning `false` produces a 403 Forbidden — throwing `UnauthorizedException` produces the correct 401 Unauthorized.

Applied per-route with `@UseGuards(AuthGuard)`, not globally — the auth and logout endpoints must remain publicly accessible.

After `AuthGuard` passes, `userId` is stamped on `req` as `req.userId`. The route handler reads it from there — it never re-verifies the token.

**WebSocket equivalent** — there is no `AuthGuard` for sockets. NestJS guards do not run on `handleConnection`. Auth is done manually at the top of `handleConnection` by parsing the `authToken` cookie from `client.handshake.headers.cookie`, calling `authService.verifyAuthToken`, and calling `client.disconnect(true)` on any failure. `disconnect(true)` force-closes the underlying transport — plain `disconnect()` only removes the socket from namespaces but leaves the WebSocket open.

#### Session persistence — `useAuth` and `authAtom`

`authAtom` is the single source of truth for client-side auth state:

```typescript
{ status: "loading" | "authenticated" | "unauthenticated", user: AuthResponseDto | null }
```

It starts as `loading`. `useAuth` runs once on app mount and calls `GET /auth/me`. If the `authToken` cookie is still valid, the server returns the user profile and `authAtom` moves to `authenticated`. If the cookie is missing or expired, the server returns 401 and `authAtom` moves to `unauthenticated`.

It is a Jotai atom rather than local component state because auth status is needed across many hooks and components simultaneously — the socket connection, route guards, the sidebar, the editor header. Prop-drilling that far would be impractical. All consumers read from the same atom and react when it changes.

---

## 6. Workspace System

### Purpose

A workspace is the top-level organizational unit in Converge. All documents belong to exactly one workspace. Users are members of workspaces with one of three roles — `owner`, `admin`, or `member` — and a workspace defines per-role document access defaults that serve as the last tier in access resolution (see [Section 8](#8-document-access-control)).

There are two workspace types:

- **Personal** — automatically created when a user signs up for the first time. Single-user; cannot be transferred to another owner.
- **Custom** — user-created. Can have multiple members with different roles.

### Roles

Roles are ordered by privilege: `owner > admin > member`. This ordering is encoded in `WORKSPACE_ROLE_RANK` from `@converge/shared` and tested via `hasWorkspaceRole(role, required)`, which returns `true` if `role` is at least as privileged as `required`.

| Role | Permissions |
|---|---|
| `owner` | Full control — rename workspace, manage all members including admins, transfer ownership, change all doc access defaults |
| `admin` | Add/remove members with role `member`, update member and non-member doc access defaults |
| `member` | Read workspace metadata and member list; subject to workspace doc access defaults |

The workspace owner also has a `workspace_members` row with `role = 'owner'`. `workspaces.owner_id` is a denormalized reference to the same user — both are kept in sync on ownership transfer.

### Module Structure

`WorkspaceModule` contains:
- `WorkspaceController` — all routes under `/workspaces`, all guarded by `AuthGuard`
- `WorkspaceService` — all business logic and DB access via `DatabaseService`

### Personal Workspace Bootstrap

On first Google login, `AuthService.authorizeGoogleUserAndGenerateJWT` calls `WorkspaceService.upsertUserPersonalWorkspace`. This runs in a transaction that:
1. Checks if a personal workspace already exists for the user (idempotent — safe to call on every login)
2. Inserts a `workspaces` row with `type = 'personal'`
3. Inserts an `owner` membership row in `workspace_members`
4. Sets `users.current_workspace_id` to the new workspace

### Current Workspace Selection

`users.current_workspace_id` tracks which workspace the user currently has selected — this drives the sidebar document library. It is updated via `PUT /workspaces/:id/select`, which only verifies the workspace exists and does not enforce membership. The same call also bumps `workspace_members.last_visited_at` (a no-op if the user is not a member), which orders workspaces by recency in the workspace list.

### Member Management

- **Add / update role**: admin+ may add new members or change a member's role. Only the owner can assign the `admin` role or modify an existing admin's role.
- **Remove**: admin+ may remove members. Only the owner can remove an admin.
- **Leave**: any non-owner member may leave. Two constraints are enforced: owners cannot leave (they must transfer ownership first); a user cannot leave their currently selected workspace (they must switch to another workspace first).
- **Transfer ownership**: owner-only, custom workspaces only. Runs in a transaction that upserts the incoming owner's membership row to `role = 'owner'`, demotes the previous owner's membership row to `role = 'admin'`, and updates `workspaces.owner_id`.

### Document Access Defaults

Each workspace stores three per-role document access defaults on the workspace row: `admin_doc_access`, `member_doc_access`, and `non_member_doc_access`. These set the default document access level for each workspace role. Any member may read them; admins may update the member and non-member defaults; only the owner may change the admin default.

### API Routes

All routes are under `/workspaces` and require `AuthGuard`.

| Method | Path | Min. access | Description |
|---|---|---|---|
| `POST` | `/` | authenticated | Create a custom workspace; caller becomes owner |
| `GET` | `/` | authenticated | List all workspaces the user is a member of |
| `GET` | `/search` | authenticated | Search user's workspaces by name (trigram) |
| `GET` | `/:id/overview` | member | Workspace metadata: member count, doc count, owner info |
| `GET` | `/:id/my-role` | member | Caller's role in the workspace |
| `PATCH` | `/:id` | admin | Rename the workspace |
| `POST` | `/:id/leave-workspace` | member (non-owner) | Remove the caller from the workspace |
| `PUT` | `/:id/select` | authenticated | Set `current_workspace_id` for the caller |
| `GET` | `/:id/members` | member | Paginated member list |
| `GET` | `/:id/members/search` | member | Search members by email (trigram) |
| `GET` | `/:id/findNewUser` | admin | Find a non-member user by exact email to invite |
| `POST` | `/:id/members` | admin | Add a member or update an existing member's role |
| `DELETE` | `/:id/members/:targetUserId` | admin | Remove a member |
| `GET` | `/:id/owner` | member | Get owner profile |
| `GET` | `/:id/owner/find` | owner | Find an ownership transfer candidate by exact email |
| `POST` | `/:id/transfer-owner` | owner | Transfer workspace ownership |
| `GET` | `/:id/doc-access-defaults` | member | Get per-role document access defaults |
| `PATCH` | `/:id/doc-access-defaults` | admin | Update per-role document access defaults |

#### GET / — workspace list

Joins `workspace_members`, `workspaces`, and `users` (for the owner's name). Results are ordered by `wm.last_visited_at DESC NULLS LAST` so the most recently visited workspace appears first. Each row also includes `isSelected: id === current_workspace_id` so the client knows which workspace is active without a separate request.

#### GET /search — workspace search

Uses PostgreSQL trigram `similarity(w.name, query)` ordered by score descending, limited to 5 results. Scoped to the caller's workspaces via the `workspace_members` join.

#### GET /:id/members — member list

Keyset pagination on `user_id ASC`. The client passes the last `user_id` from the previous page as `cursorId`; the query applies `WHERE user_id > cursorId`. `nextCursor` is `null` on the last page. Default page size is 20.

#### GET /:id/members/search — member search

Uses `similarity(u.email, query)` ordered by score descending, limited to 5. Scoped to the workspace via the `workspace_members` join.

#### POST /:id/members — add / update member

Upserts the membership row — if the user is already a member their role is updated; if not, a new row is inserted. Role hierarchy is enforced before the upsert: only the owner can assign `admin`, and only the owner can modify an existing admin's role.

#### POST /:id/transfer-owner — ownership transfer

Runs in a transaction: upserts the incoming owner's `workspace_members` row to `role = 'owner'`, updates the outgoing owner's row to `role = 'admin'`, and sets `workspaces.owner_id` to the new owner.

---

## 7. Document CRUD & Lifecycle

### Document Model

A document belongs to exactly one workspace and has a title stored in the `documents` table. Content is not stored there — it lives as an append-only log of raw Yjs binary updates in `document_updates`, reconstructed at runtime by merging all rows via `Y.mergeUpdates()`. The `documents` table also tracks soft-delete state (`is_deleted`, `deleted_at`) and compaction counters (`update_count`, `last_compact_count`).

Per-user activity is tracked in a separate `document_user_metadata` table: one row per `(document_id, user_id)` pair, storing `last_visited_at` (upserted on every WebSocket connect) and `last_edited_at` (updated on every Yjs content update and title change). These timestamps drive the library page ordering and display.

### API Routes

All routes are under `/document` and require `AuthGuard`.

| Method | Path | Min. access | Description |
|---|---|---|---|
| `POST` | `/` | workspace member | Create a new document in the given workspace |
| `GET` | `/id/:documentId` | viewer | Fetch document id, title, workspace, and resolved access |
| `DELETE` | `/:id` | admin | Soft-delete the document |
| `GET` | `/:id/overview` | viewer | Overview metadata: creator, workspace owner, created date |
| `GET` | `/library` | viewer (per doc) | Paginated document library for a workspace |
| `GET` | `/library/search` | viewer (per doc) | Trigram title search within a workspace library |
| `GET` | `/upload-auth` | authenticated | Generate a one-time ImageKit upload auth token |

### Creating a Document

`POST /document/` requires the caller to be a workspace member. Runs in a transaction that inserts the `documents` row and immediately inserts a `document_user_metadata` row for the creator, seeding their timestamps so the document appears in their library straight away.

### Soft Delete

`DELETE /document/:id` requires admin access. Sets `is_deleted = true` and `deleted_at = now()` on the documents row — no rows are ever hard-deleted. All read queries filter on `is_deleted = false`.

### Library Query

`GET /document/library` is the most complex query in the service. It resolves each document's access level for the requesting user inline in a SQL `CASE` subquery, then filters and paginates in an outer query:

**Inner subquery** — joins `documents`, `workspaces`, `document_user_metadata`, `workspace_members`, and `document_access` for the requesting user. The `CASE` expression mirrors the four-tier access resolution:

```sql
CASE
  WHEN wm.role = 'owner'            THEN 'owner'
  WHEN da.access IS NOT NULL        THEN da.access
  WHEN wm.role = 'admin'            THEN COALESCE(d.admin_doc_access, w.admin_doc_access)
  WHEN wm.role = 'member'           THEN COALESCE(d.member_doc_access, w.member_doc_access)
  ELSE                                   COALESCE(d.non_member_doc_access, w.non_member_doc_access)
END
```

**Outer query** — filters `WHERE access != 'noAccess'`, orders by `lastVisitedAt DESC NULLS LAST` with `id DESC` as a tiebreaker, and applies keyset pagination.

**Compound cursor** — because the sort column (`lastVisitedAt`) can be `NULL` (documents the user has never visited), a single-column cursor breaks. The cursor carries both `lastVisitedAt` and `id`. When paginating from a non-NULL cursor row, the WHERE clause is:

```
lastVisitedAt < cursor.lastVisitedAt
OR (lastVisitedAt = cursor.lastVisitedAt AND id < cursor.id)
OR lastVisitedAt IS NULL
```

When the cursor itself is in the NULL section, it simplifies to `WHERE id < cursor.id`.

Library search (`GET /document/library/search`) uses the same inner subquery access resolution but replaces ordering and pagination with `similarity(d.title, query)` ordered by score descending.

### ImageKit Upload Auth

ImageKit is a CDN and image hosting service. Uploads go directly from the browser to ImageKit — the server is not in the upload path. However, ImageKit requires a server-signed auth payload with every upload request so that clients cannot upload without the server's approval. This keeps the ImageKit private key on the server only.

`GET /document/upload-auth` generates that payload. The server produces three fields:

- **`token`** — a UUID generated fresh for each request, used as a nonce.
- **`expire`** — a Unix timestamp 5 minutes from now, bounding how long the payload is valid.
- **`signature`** — `HMAC-SHA1(privateKey, token + expire)`. ImageKit recomputes this using the same private key. If a client tampers with `token` or `expire`, the recomputed signature won't match and the upload is rejected — the private key is the trust anchor and never leaves the server.

The endpoint is rate-limited to 10 requests per minute per user via `UserThrottlerGuard`, since each token is a valid upload credential and uncapped calls could be used to flood storage.

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
