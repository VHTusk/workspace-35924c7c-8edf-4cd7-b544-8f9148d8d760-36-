# PostgreSQL Migration Guide

## Why Migrate?

SQLite cannot handle concurrent writes. During a tournament with 20+ players:
- Multiple check-ins simultaneously → Database locked errors
- Real-time bracket updates → Write conflicts
- Payment webhooks → Lost transactions

**PostgreSQL is REQUIRED for production.**

---

## Quick Setup (Recommended Providers for India)

### Option 1: Supabase (Easiest)
1. Go to [supabase.com](https://supabase.com)
2. Create free project (500MB free tier)
3. Go to Settings → Database → Connection string → URI
4. Copy connection string

### Option 2: Neon (Best for Serverless)
1. Go to [neon.tech](https://neon.tech)
2. Create free project
3. Copy connection string from dashboard

### Option 3: Railway
1. Go to [railway.app](https://railway.app)
2. Create PostgreSQL service
3. Copy connection string

---

## Migration Steps

### Step 1: Update Prisma Schema

Edit `prisma/schema.prisma`:

```prisma
// Change this line:
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// To this:
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Step 2: Update Environment Variables

Edit `.env`:

```bash
# Comment out SQLite
# DATABASE_URL="file:./db/custom.db"

# Add PostgreSQL (example for Supabase)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"

# For connection pooling (recommended for production)
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
```

### Step 3: Update Prisma Schema for Connection Pooling

Add to `prisma/schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### Step 4: Run Migration

```bash
# Generate Prisma client for PostgreSQL
bunx prisma generate

# Create and apply migrations
bunx prisma migrate dev --name init

# (Optional) Open Prisma Studio to verify
bunx prisma studio
```

### Step 5: Update Mini-Services

The WebSocket service in `mini-services/tournament-ws` needs to use the same database URL.

Update `mini-services/tournament-ws/.env`:
```bash
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
```

---

## PostgreSQL-Specific Changes

### 1. Array Fields (if any)
SQLite doesn't support arrays. If you have array fields, PostgreSQL handles them natively:

```prisma
model Example {
  tags String[]  // Works in PostgreSQL, not SQLite
}
```

### 2. Full-Text Search
PostgreSQL supports full-text search:

```sql
-- SQLite
WHERE name LIKE '%search%'

-- PostgreSQL (better)
WHERE to_tsvector(name) @@ to_tsquery('search')
```

### 3. JSON Operations
PostgreSQL has better JSON support:

```prisma
model Example {
  metadata Json  // Better querying in PostgreSQL
}
```

---

## Data Migration (If you have existing data)

```bash
# Export from SQLite
bunx prisma db pull
bunx prisma generate

# Export data
sqlite3 db/custom.db .dump > backup.sql

# After PostgreSQL is set up, import manually or use a tool like pgloader
```

---

## Connection Pooling (Production)

For production, use a connection pooler:

### PgBouncer (Self-hosted)
```bash
# Install
sudo apt install pgbouncer

# Configure /etc/pgbouncer/pgbouncer.ini
[databases]
valorhive = host=localhost port=5432 dbname=valorhive

[pgbouncer]
pool_mode = transaction
max_client_conn = 100
default_pool_size = 20
```

### Supabase/Neon (Built-in)
These providers include connection pooling automatically with port 6543.

---

## Verification Checklist

- [ ] Prisma schema updated to `postgresql`
- [ ] `.env` has correct `DATABASE_URL`
- [ ] `bunx prisma migrate dev` runs without errors
- [ ] `bunx prisma studio` shows database
- [ ] Mini-services updated with same database URL
- [ ] Test concurrent writes work (run multiple requests)

---

## Troubleshooting

### Error: "Can't reach database server"
- Check if IP is whitelisted (Supabase allows all by default)
- Verify connection string format
- Check if database is paused (free tier auto-pause)

### Error: "Too many connections"
- Enable connection pooling
- Reduce pool size in Prisma

### Error: "SSL connection required"
- Add `?sslmode=require` to connection string

---

## Post-Migration

1. **Backup Strategy**: Set up daily backups (Supabase/Neon do this automatically)
2. **Monitoring**: Enable database metrics in provider dashboard
3. **Read Replicas**: Consider for high-traffic tournaments (Supabase Pro feature)

---

**Time Estimate**: 30-60 minutes for migration, 2-4 hours including testing.
