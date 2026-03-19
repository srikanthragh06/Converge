# ── dev stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS dev

WORKDIR /server

COPY package*.json ./
RUN npm install

# Source is provided via volume mount in docker-compose dev mode.
COPY . .

EXPOSE 5000
CMD ["npm", "run", "dev"]

# ── builder stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /server

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── prod stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS prod

WORKDIR /server

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /server/dist ./dist

EXPOSE 5000
CMD ["npm", "start"]
