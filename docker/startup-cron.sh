#!/bin/sh
# VALORHIVE Cron Service Startup Script
#
# Handles secret loading and cron service initialization

set -e

echo "[Cron] Starting Cron Service..."

# Helper function to read secrets
read_secret() {
    if [ -f "$1" ]; then
        cat "$1" | tr -d '\n'
    else
        echo ""
    fi
}

# Load secrets
DB_USER=$(read_secret /run/secrets/db_user)
DB_PASSWORD=$(read_secret /run/secrets/db_password)
DB_NAME=$(read_secret /run/secrets/db_name)
REDIS_PASSWORD=$(read_secret /run/secrets/redis_password)

# Construct connection strings
if [ -n "$DB_USER" ] && [ -n "$DB_PASSWORD" ] && [ -n "$DB_NAME" ]; then
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}"
fi

if [ -n "$REDIS_PASSWORD" ]; then
    export REDIS_URL="redis://:${REDIS_PASSWORD}@redis:6379"
fi

# Set internal base URL for HTTP cron endpoints
export INTERNAL_BASE_URL="${INTERNAL_BASE_URL:-http://app:3000}"

# CRON_SECRET is required for authentication to internal endpoints
if [ -z "$CRON_SECRET" ]; then
    echo "[Cron] ERROR: CRON_SECRET environment variable is required"
    exit 1
fi

echo "[Cron] ✓ Secrets loaded"
echo "[Cron] Internal base URL: $INTERNAL_BASE_URL"
echo "[Cron] Starting cron scheduler..."

# Start the cron service using Node.js with tsx
exec node --import tsx index.ts
