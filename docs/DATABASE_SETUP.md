# VALORHIVE Database Setup Guide

This document provides instructions for setting up and managing the PostgreSQL database for VALORHIVE.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Production Setup](#production-setup)
4. [Database Migrations](#database-migrations)
5. [Common Operations](#common-operations)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Docker** (recommended for local development)
- **PostgreSQL 15+** (if running without Docker)
- **Redis 7+** (for caching and sessions)

---

## Local Development Setup

### Option 1: Using Docker (Recommended)

1. **Start PostgreSQL and Redis containers:**

```bash
# Start all services
bun run docker:dev

# Or using docker-compose directly
docker-compose -f docker-compose.dev.yml up -d
```

This will start:
- PostgreSQL on port `5432`
- Redis on port `6379`
- Adminer (DB UI) on port `8080` - http://localhost:8080
- Redis Commander (Redis UI) on port `8081` - http://localhost:8081

2. **Configure environment variables:**

Create a `.env` file (or use the provided `.env.example`):

```bash
cp .env.example .env
```

The default `.env` file contains:
```
DATABASE_URL="postgresql://valorhive:valorhive123@localhost:5432/valorhive?schema=public"
REDIS_URL="redis://localhost:6379"
```

3. **Initialize the database:**

```bash
# Generate Prisma client and push schema to database
bun run db:setup

# Or step by step:
bun run db:generate    # Generate Prisma client
bun run db:push        # Push schema to database (for development)
bun run db:seed        # Seed initial data (optional)
```

4. **Start the development server:**

```bash
bun run dev
```

### Option 2: Without Docker

1. **Install PostgreSQL 15+:**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS (using Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Windows
# Download from https://www.postgresql.org/download/windows/
```

2. **Create database and user:**

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create user and database
CREATE USER valorhive WITH PASSWORD 'your_secure_password';
CREATE DATABASE valorhive OWNER valorhive;
GRANT ALL PRIVILEGES ON DATABASE valorhive TO valorhive;
\q
```

3. **Update `.env` file:**

```
DATABASE_URL="postgresql://valorhive:your_secure_password@localhost:5432/valorhive?schema=public"
```

4. **Initialize database:**

```bash
bun run db:setup
```

---

## Production Setup

### Environment Variables

Set the following environment variables in production:

```bash
# Database
DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<database>?schema=public"

# Redis
REDIS_URL="redis://:<password>@<host>:<port>"

# Session
SESSION_SECRET="<secure-random-string>"
NEXTAUTH_SECRET="<secure-random-string>"
NEXTAUTH_URL="https://your-domain.com"
```

### Using Docker Compose (Production)

The production `docker-compose.yml` uses Docker secrets for sensitive data:

1. **Create secrets directory:**

```bash
mkdir -p secrets
```

2. **Create secret files:**

```bash
# Database credentials
echo "valorhive" > secrets/db_user.txt
echo "your_secure_password" > secrets/db_password.txt
echo "valorhive" > secrets/db_name.txt

# Session secret
openssl rand -base64 32 > secrets/session_secret.txt

# Redis password
openssl rand -base64 24 > secrets/redis_password.txt

# Razorpay credentials
echo "your_razorpay_key_id" > secrets/razorpay_key_id.txt
echo "your_razorpay_key_secret" > secrets/razorpay_key_secret.txt
```

3. **Start services:**

```bash
docker-compose up -d
```

4. **Run migrations:**

```bash
docker-compose exec app bun run prod:migrate
```

---

## Database Migrations

### Development Migrations

```bash
# Create a new migration after changing schema
bun run db:migrate

# Create migration without applying
bun run db:migrate:create --name descriptive_name

# Reset database (WARNING: destroys all data)
bun run db:reset

# View migration status
bun run db:migrate:status
```

### Production Migrations

```bash
# Deploy migrations (safe, non-destructive)
bun run db:migrate:deploy

# Or using the production script
bun run db:migrate:prod

# Check migration status
bun run prod:check
```

### Migration Best Practices

1. **Always test migrations locally first**
2. **Back up database before production migrations**
3. **Use transactions for data migrations**
4. **Never modify existing migrations - create new ones**

---

## Common Operations

### Database Studio

Open Prisma Studio for a visual database browser:

```bash
bun run db:studio
```

Access at http://localhost:5555

### View Database Schema

```bash
bun run db:generate
```

### Seed Database

```bash
bun run db:seed
```

### Backup Database

```bash
# Using pg_dump
docker-compose exec postgres pg_dump -U valorhive valorhive > backup_$(date +%Y%m%d).sql

# Or with pg_dumpall
docker-compose exec postgres pg_dumpall -U valorhive > backup_all_$(date +%Y%m%d).sql
```

### Restore Database

```bash
# Restore from backup
cat backup_20240101.sql | docker-compose exec -T postgres psql -U valorhive valorhive
```

### Reset Development Database

```bash
# Using npm script
bun run docker:dev:reset

# Or manually
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
bun run db:setup
```

---

## Troubleshooting

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:** Ensure PostgreSQL is running:
```bash
# Check Docker containers
docker-compose -f docker-compose.dev.yml ps

# Check container logs
docker-compose -f docker-compose.dev.yml logs postgres
```

### Authentication Failed

```
Error: P1001: Can't reach database server
```

**Solution:** Verify credentials in `.env`:
```bash
# Check if DATABASE_URL is correct
echo $DATABASE_URL

# Test connection
docker-compose exec postgres psql -U valorhive -d valorhive
```

### Migration Failed

```
Error: P3005: The database schema is not empty
```

**Solution:** 
```bash
# For development, reset database
bun run db:reset

# For production, investigate and fix migration
bun run db:migrate:status
```

### Prisma Client Not Generated

```
Error: @prisma/client did not initialize yet
```

**Solution:**
```bash
bun run db:generate
```

### Port Already in Use

```
Error: port is already allocated
```

**Solution:**
```bash
# Find and kill process using port
lsof -i :5432
kill -9 <PID>

# Or change port in docker-compose.dev.yml
```

---

## Database Schema Overview

VALORHIVE uses the following main tables:

| Table | Description |
|-------|-------------|
| `User` | Player accounts |
| `Organization` | Schools, clubs, corporations |
| `Tournament` | Tournament events |
| `Match` | Individual matches |
| `Team` | Doubles/team tournament teams |
| `Session` | User sessions |
| `AuditLog` | System audit trail |
| `PaymentLedger` | Financial transactions |

For the complete schema, see `prisma/schema.prisma`.

---

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `SESSION_SECRET` | Session encryption key | Yes |
| `NEXTAUTH_SECRET` | NextAuth.js secret | Yes |
| `NEXTAUTH_URL` | Application URL | Yes |
| `RAZORPAY_KEY_ID` | Razorpay API key | Yes (for payments) |
| `RAZORPAY_KEY_SECRET` | Razorpay secret | Yes (for payments) |

---

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review Prisma documentation: https://www.prisma.io/docs
3. Open an issue on GitHub
