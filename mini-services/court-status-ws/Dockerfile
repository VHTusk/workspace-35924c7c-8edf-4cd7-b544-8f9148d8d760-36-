# VALORHIVE Court Status WebSocket Service Dockerfile
# Node.js 20 LTS for court status real-time updates
#
# Features:
# - HTTP health endpoint on /health
# - Redis adapter for horizontal scaling (REQUIRED)
# - Proper authentication
# - Decoupled from main app internals

FROM node:20-alpine AS base

RUN apk update && apk upgrade && \
    apk add --no-cache libc6-compat curl dumb-init netcat-openbsd && \
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
COPY mini-services/court-status-ws/package.json ./mini-services/court-status-ws/
WORKDIR /app/mini-services/court-status-ws
RUN npm install

FROM base AS builder
WORKDIR /app

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=deps /app/packages/domain/node_modules ./packages/domain/node_modules
COPY --from=deps /app/mini-services/court-status-ws/node_modules ./mini-services/court-status-ws/node_modules

# Copy packages source
COPY packages/shared ./packages/shared
COPY packages/contracts ./packages/contracts
COPY packages/domain ./packages/domain

# Copy service source
COPY mini-services/court-status-ws ./mini-services/court-status-ws

WORKDIR /app/mini-services/court-status-ws
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 wsuser && \
    adduser --system --uid 1001 wsuser

# Copy packages
COPY --from=builder /app/packages/shared/src ./packages/shared/src
COPY --from=builder /app/packages/contracts/src ./packages/contracts/src
COPY --from=builder /app/packages/domain/src ./packages/domain/src

# Copy service
COPY --from=builder /app/mini-services/court-status-ws/dist ./dist
COPY --from=builder /app/mini-services/court-status-ws/node_modules ./node_modules
COPY --from=builder /app/node_modules ./node_modules

RUN chown -R wsuser:wsuser /app

USER wsuser

# Health check via HTTP endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3005/health || exit 1

LABEL org.opencontainers.image.title="VALORHIVE Court Status WebSocket"
LABEL org.opencontainers.image.description="Real-time court status updates - Redis REQUIRED"
LABEL org.opencontainers.image.version="2.0.0"

EXPOSE 3005

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
