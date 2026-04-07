#!/bin/sh
# VALORHIVE WebSocket Service Startup Script
#
# Handles secret loading and WebSocket server initialization

set -e

echo "[WebSocket] Starting WebSocket Service..."

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
    # Enable Redis for horizontal scaling
    export WS_USE_REDIS="true"
fi

echo "[WebSocket] ✓ Secrets loaded"
echo "[WebSocket] Redis state: $([ -n \"$REDIS_URL\" ] && echo 'enabled' || echo 'disabled (in-memory only)')"
echo "[WebSocket] Starting server on port 3003..."

# Start the WebSocket server using Node.js with tsx
exec node --import tsx index.ts
