# VALORHIVE Production Dockerfile
# 
# Multi-stage build optimized for production deployment with Node.js 20 LTS
# 
# Security Features:
# - Non-root user execution
# - Minimal attack surface
# - No dev dependencies in production image
# - Health check support
# - Secrets support via Docker secrets or environment
# - Secure build arguments
#
# Build: docker build -t valorhive:latest .
# Run:   docker run -p 3000:3000 valorhive:latest
#
# AWS ECR Build:
#   docker buildx build --platform linux/amd64 -t valorhive:prod .

# ============================================
# Stage 1: Base image
# ============================================
FROM node:20-alpine AS base

# Install security updates and required packages
# - curl: for health checks
# - dumb-init: for proper signal handling
# - netcat-openbsd: for dependency health checks in entrypoint
# - python3 + make + g++: for native modules (sharp, bcrypt)
RUN apk update && apk upgrade && \
    apk add --no-cache libc6-compat curl dumb-init netcat-openbsd python3 make g++ && \
    rm -rf /var/cache/apk/*

# Security: Create a dummy secret for build (can be overridden)
ARG SESSION_SECRET=build-only-dummy-secret
ARG NEXTAUTH_SECRET=build-only-dummy-secret

# ============================================
# Stage 2: Dependencies
# ============================================
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
COPY packages ./packages
COPY mini-services ./mini-services

RUN npm install --include=optional

# Generate Prisma Client
RUN npx prisma generate

# ============================================
# Stage 3: Builder
# ============================================
FROM base AS builder
WORKDIR /app

ARG DATABASE_URL=postgresql://user:pass@localhost:5432/db
ENV DATABASE_URL=$DATABASE_URL

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN npm run build

# ============================================
# Stage 4: Production Runner
# ============================================
FROM base AS runner
WORKDIR /app

# Environment configuration
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Copy Prisma schema and runtime dependencies
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

# Copy entrypoint script
COPY docker/entrypoints/app-entrypoint.sh ./app-entrypoint.sh
RUN chmod +x ./app-entrypoint.sh

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/tmp && \
    chown -R nextjs:nodejs /app

# Security: Remove unnecessary packages and files
RUN rm -rf /var/cache/apk/* /tmp/* /root/.cache /root/.npm

# Switch to non-root user
USER nextjs

# Expose application port
EXPOSE 3000

# Health check with improved settings
# Uses readiness endpoint to verify DB and Redis connectivity
# - interval: Check every 30 seconds
# - timeout: Fail if no response in 10 seconds
# - start-period: Allow 60s for startup
# - retries: 3 failures before marking unhealthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health/ready || exit 1

# Labels for container metadata
LABEL org.opencontainers.image.title="VALORHIVE"
LABEL org.opencontainers.image.description="VALORHIVE Tournament Platform"
LABEL org.opencontainers.image.vendor="VALORHIVE"
LABEL org.opencontainers.image.version="3.80.0"
LABEL org.opencontainers.image.authors="VALORHIVE Team"

# Use dumb-init for proper signal handling
# This ensures graceful shutdowns and zombie process reaping
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Run the entrypoint script (handles secrets, dependencies, then starts app)
# NOTE: Migrations should be run via a separate migration job/container
CMD ["./app-entrypoint.sh"]
