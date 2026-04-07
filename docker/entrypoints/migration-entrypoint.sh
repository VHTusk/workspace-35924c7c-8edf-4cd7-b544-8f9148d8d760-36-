#!/bin/sh
# VALORHIVE Migration Entrypoint Script
# 
# One-off container for running database migrations
# This container runs migrations and exits
#
# IMPORTANT: Run this BEFORE deploying new app replicas
# This ensures schema changes are applied before app code expects them

set -e

echo "[Migration] VALORHIVE Migration Container Starting..."
echo "[Migration] Environment: $NODE_ENV"

# ============================================
# Secret Injection
# ============================================

if [ -f /run/secrets/db_password ]; then
    export DB_PASSWORD=$(cat /run/secrets/db_password)
fi

if [ -f /run/secrets/db_user ]; then
    export DB_USER=$(cat /run/secrets/db_user)
fi

if [ -f /run/secrets/db_name ]; then
    export DB_NAME=$(cat /run/secrets/db_name)
fi

# ============================================
# Database URL Construction
# ============================================
# Migrations MUST use direct connection to PostgreSQL
# Never run migrations through PgBouncer

if [ -n "$DB_USER" ] && [ -n "$DB_PASSWORD" ] && [ -n "$DB_NAME" ]; then
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}"
    export DIRECT_URL="postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}"
fi

echo "[Migration] Database URL configured for direct PostgreSQL connection"

# ============================================
# Wait for PostgreSQL
# ============================================

echo "[Migration] Waiting for PostgreSQL..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if nc -w 2 postgres 5432 > /dev/null 2>&1; then
        echo "[Migration] PostgreSQL is ready"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "[Migration] Waiting for PostgreSQL... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "[Migration] Error: PostgreSQL not available after $MAX_RETRIES attempts"
    exit 1
fi

# ============================================
# Run Migrations
# ============================================

echo "[Migration] Running Prisma migrations..."

# Use deploy mode for production (no interactive prompts)
npx prisma migrate deploy --schema=/app/prisma/schema.prisma

if [ $? -eq 0 ]; then
    echo "[Migration] ✓ Migrations applied successfully"
else
    echo "[Migration] ✗ Migration failed"
    exit 1
fi

# ============================================
# Verify Database Schema
# ============================================

echo "[Migration] Verifying database schema..."

# Quick sanity check - try to query the database
echo "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | npx prisma db execute --stdin > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "[Migration] ✓ Database schema verified"
else
    echo "[Migration] Warning: Could not verify schema, but migrations completed"
fi

echo "[Migration] Migration complete. Exiting."
exit 0
