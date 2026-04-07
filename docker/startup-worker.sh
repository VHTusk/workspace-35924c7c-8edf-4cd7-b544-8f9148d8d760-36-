#!/bin/sh
# VALORHIVE Worker Startup Script
#
# Handles secret loading and worker initialization

set -e

echo "[Worker] Starting Background Worker..."

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
AWS_ACCESS_KEY_ID=$(read_secret /run/secrets/aws_access_key)
AWS_SECRET_ACCESS_KEY=$(read_secret /run/secrets/aws_secret_key)

# Construct connection strings
if [ -n "$DB_USER" ] && [ -n "$DB_PASSWORD" ] && [ -n "$DB_NAME" ]; then
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}"
fi

if [ -n "$REDIS_PASSWORD" ]; then
    export REDIS_URL="redis://:${REDIS_PASSWORD}@redis:6379"
fi

if [ -n "$AWS_ACCESS_KEY_ID" ]; then
    export AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
fi

if [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
    export AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
fi

echo "[Worker] ✓ Secrets loaded"
echo "[Worker] Starting worker process..."

# Set queue concurrency (default: 10)
QUEUE_CONCURRENCY=${QUEUE_CONCURRENCY:-10}
export QUEUE_CONCURRENCY

# Start the worker
exec node dist/worker.js
