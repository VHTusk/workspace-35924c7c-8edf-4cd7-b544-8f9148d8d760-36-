#!/bin/sh
# VALORHIVE Production Startup Script
#
# This script handles:
# 1. Database migrations (safe production deployment)
# 2. Prisma client generation
# 3. Application startup

set -e

echo "[Startup] VALORHIVE Production Container Starting..."
echo "[Startup] Environment: $NODE_ENV"
echo "[Startup] Node Version: $(node --version)"

# ============================================
# Step 1: Run Database Migrations
# ============================================
echo "[Startup] Running database migrations..."

# Only run migrations in production, not in development
if [ "$NODE_ENV" = "production" ]; then
    # Run Prisma migrations (deploy mode - no interactive prompts)
    npx prisma migrate deploy --schema=/app/prisma/schema.prisma
    
    if [ $? -eq 0 ]; then
        echo "[Startup] ✓ Migrations applied successfully"
    else
        echo "[Startup] ✗ Migration failed - exiting"
        exit 1
    fi
else
    echo "[Startup] Skipping migrations in development mode"
fi

# ============================================
# Step 2: Verify Database Connection
# ============================================
echo "[Startup] Verifying database connection..."

# Wait for database to be ready (for container startup timing)
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
        echo "[Startup] ✓ Database connection verified"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "[Startup] Waiting for database... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "[Startup] ✗ Database connection failed after $MAX_RETRIES attempts"
    exit 1
fi

# ============================================
# Step 3: Start Application
# ============================================
echo "[Startup] Starting Next.js server..."

# Start the standalone server
exec node server.js
