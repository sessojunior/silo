FROM node:22-alpine AS base
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*
WORKDIR /app

# ─── Install dependencies ────────────────────────────────────────────────────
FROM base AS installer
COPY . .
RUN npm ci --legacy-peer-deps

# ─── Build ───────────────────────────────────────────────────────────────────
FROM installer AS builder
ENV NODE_ENV=production
RUN npm run build -w @silo/worker

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 workeruser

COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/apps/worker/src ./apps/worker/src
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/packages/engine ./packages/engine
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER workeruser

# Usa tsx para executar, pois o worker compila com module:preserve
# (imports sem extensão .js) e o Node.js nativo não resolve esses paths.
CMD ["./node_modules/.bin/tsx", "apps/worker/src/index.ts"]
