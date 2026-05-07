FROM node:22-alpine AS base
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

# ─── Prune monorepo for web ──────────────────────────────────────────────────
FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@latest
COPY . .
RUN turbo prune @silo/web --docker

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
ENV DRIZZLE_TELEMETRY_DISABLED=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @silo/web

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

RUN mkdir -p uploads && chown nextjs:nodejs uploads
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
