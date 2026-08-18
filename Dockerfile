# Production image: builds the frontend (static files) and backend
# (compiled TypeScript), then ships a slim runtime that serves both from a
# single Express process. Not used for local dev — see .devcontainer/ for
# that; this is for `docker build .` / the GitHub Actions image publish.

FROM node:20-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY backend/prisma backend/prisma
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY backend backend
COPY frontend frontend
RUN npm run build

FROM node:20-bookworm-slim AS prod-deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY backend/prisma backend/prisma
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev

FROM node:20-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/studentracker.db
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
COPY --from=build --chown=node:node /app/backend/prisma ./backend/prisma
COPY --chown=node:node backend/package.json ./backend/package.json
COPY --from=build --chown=node:node /app/frontend/dist ./frontend/dist
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME /app/data
EXPOSE 3000
USER node
WORKDIR /app/backend
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
