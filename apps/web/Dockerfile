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
