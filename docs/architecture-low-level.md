# Converge — Low-Level Architecture

A technical reference for the Converge codebase. Covers module responsibilities, data flows, key decisions, and implementation details. Written for returning-to-the-project context.

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
