FROM node:22-alpine AS base
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

# ─── Prune monorepo for worker ───────────────────────────────────────────────
FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@latest
COPY . .
RUN turbo prune @silo/worker --docker

# ─── Install dependencies ────────────────────────────────────────────────────
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN npm ci --legacy-peer-deps

# ─── Build ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=installer /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .
ENV NODE_ENV=production
RUN npm run build -w @silo/worker

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 workeruser

COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker/package.json ./package.json

USER workeruser

CMD ["node", "dist/index.js"]
