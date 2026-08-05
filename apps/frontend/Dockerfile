FROM node:22-alpine@sha256:76789712cd1ae89a1225eac9077010d68987a423588042dac30446f502f1858c AS base
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*
WORKDIR /app

# ─── Install dependencies ────────────────────────────────────────────────────
FROM base AS deps
# Copia pacotes compartilhados necessarios para resolver file: no package.json
COPY apps/frontend/package.json apps/frontend/
COPY packages/engine/package.json packages/engine/
COPY packages/engine/src/ packages/engine/src/
COPY packages/config/package.json packages/config/
COPY packages/config/ packages/config/
WORKDIR /app/apps/frontend
RUN npm install --legacy-peer-deps

# ─── Build ───────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY apps/frontend/ apps/frontend/
WORKDIR /app/apps/frontend
ARG NEXT_PUBLIC_BASE_PATH=/silo
ARG APP_URL_DEV=http://localhost
ARG APP_URL_PROD=http://localhost
ARG NEXT_PUBLIC_API_ORIGIN=http://localhost:4000
ENV NODE_ENV=production
ENV DRIZZLE_TELEMETRY_DISABLED=1
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV APP_URL_DEV=${APP_URL_DEV}
ENV APP_URL_PROD=${APP_URL_PROD}
ENV NEXT_PUBLIC_API_ORIGIN=${NEXT_PUBLIC_API_ORIGIN}
RUN npm run build

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

RUN mkdir -p ./apps/frontend/.next/cache && chown -R nextjs:nodejs ./apps/frontend/.next

RUN mkdir -p uploads && chown nextjs:nodejs uploads
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/frontend/server.js"]
