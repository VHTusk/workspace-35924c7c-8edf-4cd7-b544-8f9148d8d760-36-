#!/bin/sh
# VALORHIVE Production Startup Script with Secret Handling
#
# This script handles:
# 1. Reading Docker secrets and setting environment variables
# 2. Database migrations (safe production deployment)
# 3. Application startup
#
# Docker secrets are mounted at /run/secrets/<secret_name>
# This script reads them and exports as environment variables
# for applications that don't natively support _FILE suffix.

set -e

echo "[Startup] VALORHIVE Production Container Starting..."
echo "[Startup] Environment: $NODE_ENV"
echo "[Startup] Node Version: $(node --version)"

# ============================================
# Helper Function: Read Secret File
# ============================================
# Reads a secret file if it exists, returns empty string otherwise
read_secret() {
    secret_path="$1"
    if [ -f "$secret_path" ]; then
        # Read and trim whitespace (secrets often have trailing newlines)
        cat "$secret_path" | tr -d '\n'
    else
        echo ""
    fi
}

# ============================================
# Step 1: Load Secrets into Environment
# ============================================
echo "[Startup] Loading secrets from /run/secrets..."

# Database secrets
DB_USER=$(read_secret /run/secrets/db_user)
DB_PASSWORD=$(read_secret /run/secrets/db_password)
DB_NAME=$(read_secret /run/secrets/db_name)

# Redis secret
REDIS_PASSWORD=$(read_secret /run/secrets/redis_password)

# Session secret
SESSION_SECRET=$(read_secret /run/secrets/session_secret)

# AWS secrets
AWS_ACCESS_KEY_ID=$(read_secret /run/secrets/aws_access_key)
AWS_SECRET_ACCESS_KEY=$(read_secret /run/secrets/aws_secret_key)

# ============================================
# Step 2: Construct Connection Strings
# ============================================
# Only construct if not already set (allows override via env)
if [ -z "$DATABASE_URL" ] && [ -n "$DB_USER" ] && [ -n "$DB_PASSWORD" ] && [ -n "$DB_NAME" ]; then
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}"
    echo "[Startup] ✓ DATABASE_URL constructed from secrets"
fi

if [ -z "$DIRECT_DATABASE_URL" ] && [ -n "$DB_USER" ] && [ -n "$DB_PASSWORD" ] && [ -n "$DB_NAME" ]; then
    export DIRECT_DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}"
    echo "[Startup] ✓ DIRECT_DATABASE_URL constructed from secrets"
fi

if [ -z "$REDIS_URL" ] && [ -n "$REDIS_PASSWORD" ]; then
    export REDIS_URL="redis://:${REDIS_PASSWORD}@redis:6379"
    echo "[Startup] ✓ REDIS_URL constructed from secrets"
fi

# Export remaining secrets
if [ -n "$SESSION_SECRET" ]; then
    export SESSION_SECRET="$SESSION_SECRET"
fi

if [ -n "$AWS_ACCESS_KEY_ID" ]; then
    export AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
fi

if [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
    export AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
fi

echo "[Startup] ✓ Secrets loaded successfully"

# ============================================
# Step 3: Run Database Migrations
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
# Step 4: Verify Database Connection
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
# Step 5: Start Application
# ============================================
echo "[Startup] Starting Next.js server..."

# Start the standalone server
exec node server.js
