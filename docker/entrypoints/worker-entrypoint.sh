#!/bin/sh
# VALORHIVE Worker Entrypoint Script
# 
# Handles secret injection and environment setup for background workers
# Workers use PgBouncer for database connections (same as app)

set -e

echo "[Worker] VALORHIVE Worker Container Starting..."
echo "[Worker] Environment: $NODE_ENV"
echo "[Worker] Node Version: $(node --version)"

# ============================================
# Secret Injection
# ============================================

# Read secrets from Docker secrets files and export as env vars
if [ -f /run/secrets/db_password ]; then
    export DB_PASSWORD=$(cat /run/secrets/db_password)
fi

if [ -f /run/secrets/db_user ]; then
    export DB_USER=$(cat /run/secrets/db_user)
fi

if [ -f /run/secrets/db_name ]; then
    export DB_NAME=$(cat /run/secrets/db_name)
fi

if [ -f /run/secrets/redis_password ]; then
    export REDIS_PASSWORD=$(cat /run/secrets/redis_password)
fi

if [ -f /run/secrets/session_secret ]; then
    export SESSION_SECRET=$(cat /run/secrets/session_secret)
fi

# ============================================
# Database URL Construction
# ============================================

if [ -n "$DB_USER" ] && [ -n "$DB_PASSWORD" ] && [ -n "$DB_NAME" ]; then
    # Workers use PgBouncer for pooled connections (same as app)
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@pgbouncer:6432/${DB_NAME}"
    # Direct URL for any admin operations (rare)
    export DIRECT_URL="postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}"
fi

if [ -n "$REDIS_PASSWORD" ]; then
    export REDIS_URL="redis://:${REDIS_PASSWORD}@redis:6379"
fi

# ============================================
# Wait for Dependencies
# ============================================

# Wait for Redis (critical for job queues)
echo "[Worker] Waiting for Redis..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if nc -w 2 redis 6379 > /dev/null 2>&1; then
        echo "[Worker] Redis is ready"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "[Worker] Waiting for Redis... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "[Worker] Error: Redis not available after $MAX_RETRIES attempts"
    exit 1
fi

# Wait for PgBouncer
echo "[Worker] Waiting for PgBouncer..."
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if echo "SELECT 1;" | nc -w 2 pgbouncer 6432 > /dev/null 2>&1; then
        echo "[Worker] PgBouncer is ready"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "[Worker] Waiting for PgBouncer... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "[Worker] Error: PgBouncer not available after $MAX_RETRIES attempts"
    exit 1
fi

# ============================================
# Start Worker
# ============================================

echo "[Worker] Starting with concurrency: ${QUEUE_CONCURRENCY:-10}"
echo "[Worker] Redis URL: ${REDIS_URL:-not configured}"
echo "[Worker] Database: ${DATABASE_URL:+configured via PgBouncer}"

exec node dist/workers/index.js
