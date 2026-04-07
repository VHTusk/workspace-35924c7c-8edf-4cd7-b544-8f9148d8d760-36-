# SQLite to PostgreSQL Migration Guide

This document explains how to migrate from SQLite to PostgreSQL.

## Overview

VALORHIVE has been migrated from SQLite to PostgreSQL for better performance, scalability, and production readiness.

## Key Differences

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Data Types | `TEXT`, `INTEGER`, `REAL` | `VARCHAR`, `INTEGER`, `DECIMAL`, native enums |
| Dates | `DATETIME` | `TIMESTAMP WITH TIME ZONE` |
| Primary Keys | Inline `PRIMARY KEY` | Separate `PRIMARY KEY` constraint |
| Enums | `TEXT` columns | Native `ENUM` types |
| Schema | Single database | Multiple schemas (default: `public`) |
| Concurrency | Limited | Full ACID compliance |

## Migration Steps

### Step 1: Start PostgreSQL

```bash
# Start PostgreSQL container
bun run docker:dev
```

### Step 2: Update Environment Variables

Ensure your `.env` file uses PostgreSQL:

```bash
DATABASE_URL="postgresql://valorhive:valorhive123@localhost:5432/valorhive?schema=public"
```

### Step 3: Create Database Schema

For development:
```bash
# Push schema directly (no migration files)
bun run db:push

# Seed initial data
bun run db:seed
```

For production:
```bash
# Create and apply migrations
bun run db:migrate:deploy
```

### Step 4: Migrate Data (if applicable)

If you have existing SQLite data to migrate:

```bash
# Export data from SQLite
sqlite3 db/custom.db .dump > sqlite_backup.sql

# Convert SQLite syntax to PostgreSQL
# Note: This requires manual conversion of:
# - DATETIME → TIMESTAMP
# - TEXT enums → PostgreSQL ENUMs
# - AUTOINCREMENT → SERIAL

# Import into PostgreSQL
psql $DATABASE_URL < converted_backup.sql
```

## Schema Changes

The following changes were made to `prisma/schema.prisma`:

```diff
datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

## Query Considerations

Most Prisma queries work identically between SQLite and PostgreSQL. However, be aware of:

1. **String comparisons**: PostgreSQL is case-sensitive by default
2. **Date handling**: PostgreSQL uses `TIMESTAMP WITH TIME ZONE`
3. **JSON operations**: PostgreSQL has native JSON support
4. **Full-text search**: PostgreSQL has built-in full-text search

## Troubleshooting

### Error: Can't reach database server

Ensure PostgreSQL is running:
```bash
docker-compose -f docker-compose.dev.yml ps
```

### Error: P3005 database schema not empty

Reset the database:
```bash
bun run db:reset
```

### Migration errors

Delete the migrations folder and start fresh:
```bash
rm -rf prisma/migrations
bun run db:migrate
```
