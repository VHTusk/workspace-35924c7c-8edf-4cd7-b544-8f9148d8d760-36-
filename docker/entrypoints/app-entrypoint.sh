#!/bin/sh
# VALORHIVE App Entrypoint Script
# 
# Handles secret injection and environment setup for production
# This is the canonical entrypoint for the main application container
#
# IMPORTANT: Migrations should be run via a separate migration job/service
# App replicas should NOT run migrations on startup

set -e

echo "[App] VALORHIVE Production Container Starting..."
echo "[App] Environment: $NODE_ENV"
echo "[App] Node Version: $(node --version)"

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

if [ -f /run/secrets/aws_access_key ]; then
    export AWS_ACCESS_KEY_ID=$(cat /run/secrets/aws_access_key)
fi

if [ -f /run/secrets/aws_secret_key ]; then
    export AWS_SECRET_ACCESS_KEY=$(cat /run/secrets/aws_secret_key)
fi

# ============================================
# Database URL Construction
# ============================================

if [ -n "$DB_USER" ] && [ -n "$DB_PASSWORD" ] && [ -n "$DB_NAME" ]; then
    # For PgBouncer (pooled connections for app traffic)
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@pgbouncer:6432/${DB_NAME}"
    # Direct connection for migrations (if needed by admin tools)
    export DIRECT_URL="postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}"
fi

if [ -n "$REDIS_PASSWORD" ]; then
    export REDIS_URL="redis://:${REDIS_PASSWORD}@redis:6379"
fi

# ============================================
# Wait for Dependencies (Health Check)
# ============================================

# Wait for PgBouncer to be ready
echo "[App] Waiting for PgBouncer..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if echo "SELECT 1;" | nc -w 2 pgbouncer 6432 > /dev/null 2>&1; then
        echo "[App] PgBouncer is ready"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "[App] Waiting for PgBouncer... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "[App] Warning: PgBouncer not available after $MAX_RETRIES attempts, proceeding anyway"
fi

# Wait for Redis to be ready
echo "[App] Waiting for Redis..."
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if nc -w 2 redis 6379 > /dev/null 2>&1; then
        echo "[App] Redis is ready"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "[App] Waiting for Redis... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "[App] Warning: Redis not available after $MAX_RETRIES attempts, proceeding anyway"
fi

# ============================================
# Start Application
# ============================================

echo "[App] Starting Next.js server..."
echo "[App] Redis URL: ${REDIS_URL:+configured}"
echo "[App] Database: ${DATABASE_URL:+configured via PgBouncer}"

# Start the Next.js production server
exec npm run start
