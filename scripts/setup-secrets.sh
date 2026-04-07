#!/bin/bash

# VALORHIVE Secrets Setup Script
# Run this script to generate secret files for Docker Compose
# DO NOT commit the secrets/ directory to version control

set -e

SECRETS_DIR="./secrets"

# Create secrets directory if it doesn't exist
mkdir -p "$SECRETS_DIR"

# Function to generate a random secret
generate_secret() {
    openssl rand -base64 32 | tr -d '\n'
}

# Function to create a secret file
create_secret_file() {
    local filename=$1
    local value=$2
    
    echo -n "$value" > "$SECRETS_DIR/$filename"
    echo "Created $SECRETS_DIR/$filename"
}

echo "=== VALORHIVE Secrets Setup ==="
echo "This script will create secret files for Docker Compose."
echo ""

# Check if secrets already exist
if [ -f "$SECRETS_DIR/db_password.txt" ]; then
    echo "Warning: Some secret files already exist."
    read -p "Do you want to regenerate them? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

echo ""
echo "Creating secret files..."
echo ""

# Database secrets
create_secret_file "db_user.txt" "valorhive"
create_secret_file "db_password.txt" "$(generate_secret)"
create_secret_file "db_name.txt" "valorhive"

# Session secret
create_secret_file "session_secret.txt" "$(generate_secret)"

# Redis password
create_secret_file "redis_password.txt" "$(generate_secret)"

# Razorpay (prompt user to enter these)
echo ""
echo "=== Razorpay Credentials ==="
echo "Enter your Razorpay Key ID (or press Enter to generate placeholder):"
read -r RAZORPAY_KEY_ID
if [ -z "$RAZORPAY_KEY_ID" ]; then
    RAZORPAY_KEY_ID="rzp_test_placeholder"
fi
create_secret_file "razorpay_key_id.txt" "$RAZORPAY_KEY_ID"

echo "Enter your Razorpay Key Secret (or press Enter to generate placeholder):"
read -r RAZORPAY_KEY_SECRET
if [ -z "$RAZORPAY_KEY_SECRET" ]; then
    RAZORPAY_KEY_SECRET="$(generate_secret)"
fi
create_secret_file "razorpay_key_secret.txt" "$RAZORPAY_KEY_SECRET"

# Set proper permissions
chmod 600 "$SECRETS_DIR"/*.txt
echo ""
echo "=== Setting Permissions ==="
echo "Set file permissions to 600 (owner read/write only)"

# Create .gitignore entry if not exists
if ! grep -q "secrets/" .gitignore 2>/dev/null; then
    echo "secrets/" >> .gitignore
    echo "Added 'secrets/' to .gitignore"
fi

echo ""
echo "=== Secrets Setup Complete ==="
echo ""
echo "Created files:"
ls -la "$SECRETS_DIR"
echo ""
echo "IMPORTANT:"
echo "1. DO NOT commit the secrets/ directory to version control"
echo "2. Back up these files securely"
echo "3. For production, use a secrets manager (AWS Secrets Manager, HashiCorp Vault)"
echo ""
