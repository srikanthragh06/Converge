FROM node:20-alpine AS dev

# corepack ships with Node and manages package manager versions.
# Activating pnpm via corepack ensures the version matches packageManager in package.json.
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy workspace manifests first so dependency installation is cached as a
# separate layer — only re-runs when lockfile or package.json files change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

# Copy source after installing deps so source changes don't bust the cache.
COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

# Build shared once so Vite can resolve @converge/shared on startup.
RUN pnpm --filter @converge/shared build

# Run shared in watch mode alongside Vite so changes to shared are
# reflected without rebuilding the image.
CMD ["sh", "-c", "pnpm --filter @converge/shared build:watch & pnpm --filter web dev"]
