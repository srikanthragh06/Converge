# Lightweight Node.js 20 image based on Alpine Linux.
FROM node:20-alpine

WORKDIR /web

# Copy manifests first so Docker can cache the npm install layer separately
# from source changes — only re-runs when package*.json changes.
COPY package*.json ./
RUN npm install

# Copy source after installing deps. In docker-compose dev mode this is
# overridden by the volume mount, but it makes the image self-contained.
COPY . .

EXPOSE 5173

# Runs Vite dev server. host: true in vite.config.ts ensures it binds to
# 0.0.0.0, making it reachable via the docker-compose port mapping.
CMD ["npm", "run", "dev"]
