# VALORHIVE Cron Service Dockerfile
# Node.js 20 LTS for scheduled jobs
#
# Fully decoupled from main app internals.
# Uses HTTP API calls to main app endpoints.
# Imports shared types from @valorhive packages.

FROM node:20-alpine AS base

RUN apk update && apk upgrade && \
    apk add --no-cache libc6-compat curl dumb-init && \
    rm -rf /var/cache/apk/*

FROM base AS deps
WORKDIR /app

# Copy workspace package files
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/

# Install dependencies
RUN npm ci --include=optional

# Copy service-specific package files
COPY mini-services/cron-service/package.json ./mini-services/cron-service/
WORKDIR /app/mini-services/cron-service
RUN npm install

FROM base AS builder
WORKDIR /app

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=deps /app/packages/domain/node_modules ./packages/domain/node_modules
COPY --from=deps /app/mini-services/cron-service/node_modules ./mini-services/cron-service/node_modules

# Copy packages source
COPY packages/shared ./packages/shared
COPY packages/contracts ./packages/contracts
COPY packages/domain ./packages/domain

# Copy service source
COPY mini-services/cron-service ./mini-services/cron-service

WORKDIR /app/mini-services/cron-service
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 cronuser && \
    adduser --system --uid 1001 cronuser

# Copy packages
COPY --from=builder /app/packages/shared/src ./packages/shared/src
COPY --from=builder /app/packages/contracts/src ./packages/contracts/src
COPY --from=builder /app/packages/domain/src ./packages/domain/src

# Copy service
COPY --from=builder /app/mini-services/cron-service/dist ./dist
COPY --from=builder /app/mini-services/cron-service/node_modules ./node_modules
COPY --from=builder /app/node_modules ./node_modules

RUN chown -R cronuser:cronuser /app

USER cronuser

HEALTHCHECK --interval=60s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3004/health || exit 1

LABEL org.opencontainers.image.title="VALORHIVE Cron Service"
LABEL org.opencontainers.image.description="Scheduled jobs - decoupled from main app"
LABEL org.opencontainers.image.version="2.0.0"

EXPOSE 3004

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
