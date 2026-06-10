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
RUN npm run build -w @silo/api

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 apiuser

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/src ./apps/api/src
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
# Copy @silo/database package for runtime migrations
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/packages/engine ./packages/engine
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

RUN mkdir -p uploads && chown apiuser:nodejs uploads
# Garante que o usuário apiuser possa escrever no diretório de migrations (db:generate)
RUN mkdir -p /app/packages/db/drizzle/meta && chown -R apiuser:nodejs /app/packages/db/drizzle
COPY entrypoint-api.sh ./entrypoint.sh
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

USER apiuser
EXPOSE 4000

ENTRYPOINT ["./entrypoint.sh"]
