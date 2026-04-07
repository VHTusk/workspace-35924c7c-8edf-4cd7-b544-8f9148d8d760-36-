# VALORHIVE Tournament WebSocket Service
# Production Dockerfile for the tournament WebSocket mini-service

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache libc6-compat && \
    rm -rf /var/cache/apk/*

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production

# ============================================
# Stage 2: Builder
# ============================================
FROM deps AS builder
WORKDIR /app

# Install dev dependencies for build
RUN npm ci

# Copy all files
COPY . .

# Build TypeScript using tsc
RUN npx tsc --outDir ./dist

# ============================================
# Stage 3: Production Runner
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

# Install security updates and curl for health check
RUN apk update && apk upgrade && \
    apk add --no-cache curl && \
    rm -rf /var/cache/apk*

# Environment
ENV NODE_ENV=production
ENV PORT=3003

# Create non-root user
RUN addgroup --system --gid 1001 wsuser && \
    adduser --system --uid 1001 wsuser

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Set permissions
RUN chown -R wsuser:wsuser /app

# Switch to non-root user
USER wsuser

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3003/health || exit 1

# Start the service
CMD ["node", "dist/index.js"]
