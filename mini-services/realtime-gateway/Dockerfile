# VALORHIVE Unified Realtime Gateway
# Production Dockerfile for the unified WebSocket gateway
#
# This service consolidates:
# - Tournament WebSocket (formerly tournament-ws)
# - Court Status WebSocket (formerly court-status-ws)
#
# Port: 3004 (configurable via REALTIME_PORT env var)
# Health endpoints: /health, /ready

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache libc6-compat && \
    rm -rf /var/cache/apk/*

# Copy package files from root and realtime-gateway
COPY package.json package-lock.json* ./
COPY mini-services/realtime-gateway/package.json ./mini-services/realtime-gateway/

# Install root dependencies (for shared modules like db, auth-canonical)
RUN npm ci

# Install realtime-gateway specific dependencies
WORKDIR /app/mini-services/realtime-gateway
RUN npm ci

# ============================================
# Stage 2: Builder
# ============================================
FROM deps AS builder
WORKDIR /app

# Copy all source files needed for build
COPY . .

# Build TypeScript using tsc
RUN npx tsc --project mini-services/realtime-gateway/tsconfig.json

# ============================================
# Stage 3: Production Runner
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

# Install security updates and curl for health check
RUN apk update && apk upgrade && \
    apk add --no-cache curl && \
    rm -rf /var/cache/apk/*

# Environment
ENV NODE_ENV=production
ENV REALTIME_PORT=3004

# Create non-root user
RUN addgroup --system --gid 1001 wsuser && \
    adduser --system --uid 1001 wsuser

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/mini-services/realtime-gateway/node_modules ./mini-services/realtime-gateway/node_modules

# Set permissions
RUN chown -R wsuser:wsuser /app

# Switch to non-root user
USER wsuser

# Expose port
EXPOSE 3004

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3004/health || exit 1

# Start the service
CMD ["node", "dist/index.js"]
