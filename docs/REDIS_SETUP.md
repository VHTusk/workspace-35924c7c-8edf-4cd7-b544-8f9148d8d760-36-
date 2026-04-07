# Redis Caching Layer - VALORHIVE

This document describes the Redis caching implementation for VALORHIVE, including configuration, usage patterns, and best practices.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Configuration](#configuration)
4. [Usage Patterns](#usage-patterns)
5. [Cache Invalidation](#cache-invalidation)
6. [Health Monitoring](#health-monitoring)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Redis is used as a caching layer to improve performance and reduce database load. The implementation includes:

- **Leaderboard Caching** - 5-second TTL for real-time accuracy
- **Tournament Bracket Caching** - 10-second TTL for live tournaments
- **Player Stats Caching** - 30-second TTL for profile data
- **Organization Stats Caching** - 60-second TTL for org data
- **Session Caching** - 5-minute TTL with automatic refresh
- **Rate Limiting** - Distributed rate limiting with Lua scripts

### Fallback Behavior

When Redis is unavailable, the system automatically falls back to an in-memory cache, ensuring the application continues to function. This makes Redis optional for development environments.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API Routes                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │              Cache Service Layer                      │  │
│   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐     │  │
│   │  │ Leaderboard │ │   Player    │ │     Org     │     │  │
│   │  │   Cache     │ │ Stats Cache │ │ Stats Cache │     │  │
│   │  └─────────────┘ └─────────────┘ └─────────────┘     │  │
│   └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│   ┌──────────────────────────────────────────────────────┐  │
│   │              Redis Client (ioredis/redis)             │  │
│   │         ┌─────────────────────────────────┐           │  │
│   │         │  Connection Pool & Retry Logic  │           │  │
│   │         └─────────────────────────────────┘           │  │
│   └──────────────────────────────────────────────────────┘  │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │      Redis Server       │
              │   ┌─────────────────┐   │
              │   │  In-Memory Data │   │
              │   │  with AOF/RDB   │   │
              │   └─────────────────┘   │
              └─────────────────────────┘
```

---

## Configuration

### Environment Variables

```bash
# Basic Redis URL
REDIS_URL="redis://localhost:6379"

# Production with authentication
REDIS_URL="redis://:your_password@redis-host:6379"

# TLS Configuration (recommended for production)
REDIS_TLS_ENABLED="true"
REDIS_TLS_REJECT_UNAUTHORIZED="true"

# Connection Pool
REDIS_MAX_RETRIES="5"
REDIS_RETRY_DELAY="100"
REDIS_POOL_MIN="1"
REDIS_POOL_MAX="10"

# Sentinel (High Availability)
REDIS_SENTINEL_HOSTS="sentinel1:26379,sentinel2:26379,sentinel3:26379"
REDIS_SENTINEL_MASTER="mymaster"

# Cluster (Horizontal Scaling)
REDIS_CLUSTER_NODES="node1:6379,node2:6379,node3:6379"
```

### Docker Compose (Development)

```yaml
# docker-compose.dev.yml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### Docker Compose (Production)

```yaml
# docker-compose.yml (with secrets)
secrets:
  redis_password:
    file: ./secrets/redis_password.txt

services:
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass $(cat /run/secrets/redis_password) --appendonly yes
    secrets:
      - redis_password
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "$(cat /run/secrets/redis_password)", "ping"]
```

---

## Usage Patterns

### Basic Caching

```typescript
import { cache, CACHE_TTL } from '@/lib/cache';

// Get or set with fallback
const data = await cache.getOrSet(
  'my-key',
  async () => {
    // Fetch from database if cache miss
    return await db.user.findMany({ ... });
  },
  CACHE_TTL.PLAYER_STATS // 30 seconds
);
```

### Leaderboard Caching

```typescript
import { leaderboardCache } from '@/lib/cache';

// Get cached leaderboard
const cached = await leaderboardCache.getLeaderboard({
  sport: 'CORNHOLE',
  scope: 'national',
});

if (!cached) {
  // Fetch from database and cache
  const data = await fetchLeaderboardFromDB();
  await leaderboardCache.setLeaderboard(
    { sport: 'CORNHOLE', scope: 'national' },
    data
  );
}
```

### Session Caching

```typescript
import { sessionCache } from '@/lib/session-cache';

// Get cached session
const cached = await sessionCache.getSessionWithUser(tokenHash);

if (!cached) {
  // Fetch from database
  const session = await validateSession(token);
  // Cache for future requests
  await sessionCache.setSessionWithUser(tokenHash, session);
}
```

---

## Cache Invalidation

### Automatic Invalidation

Cache invalidation happens automatically when data changes:

```typescript
// In elo-transaction.ts - after match result
if (result.success) {
  await invalidateAfterMatchResult({
    sport,
    playerIds: [playerAId, playerBId],
    tournamentId,
  });
}
```

### Manual Invalidation

```typescript
import { cacheInvalidation } from '@/lib/cache-invalidation';

// Invalidate specific caches
await cacheInvalidation.leaderboardForSport('CORNHOLE');
await cacheInvalidation.playerStats(userId, 'CORNHOLE');
await cacheInvalidation.tournamentBracket(tournamentId);

// Invalidate all caches for a sport
await cacheInvalidation.allForSport('CORNHOLE');
```

### Using the Middleware Helper

```typescript
import { withCacheInvalidation } from '@/lib/cache-invalidation';

const updatePlayerWithInvalidation = withCacheInvalidation(
  async (id: string, data: any) => {
    return prisma.user.update({ where: { id }, data });
  },
  (result) => ({
    type: 'player',
    playerId: result.id,
    sport: result.sport,
    invalidateLeaderboard: true,
  })
);
```

---

## Health Monitoring

### Health Check Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Basic health with Redis status |
| `GET /api/health/redis` | Detailed Redis health |
| `GET /api/health/redis?detailed=true` | Full Redis metrics |
| `GET /api/health/redis?latency=true` | Latency measurement |

### Example Responses

**Basic Health Check:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "VALORHIVE",
  "version": "3.6.0",
  "responseTime": "5ms",
  "components": {
    "redis": {
      "status": "connected",
      "latency": "2ms"
    }
  }
}
```

**Detailed Redis Health:**
```json
{
  "status": "healthy",
  "healthy": true,
  "connected": true,
  "latency": 1.234,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "details": {
    "version": "7.2.3",
    "mode": "standalone",
    "role": "master",
    "uptime": "5d 12h 30m",
    "clients": {
      "connected": 15,
      "blocked": 0
    },
    "memory": {
      "used": "12.5 MB",
      "peak": "25.3 MB",
      "percentage": 1.2
    },
    "performance": {
      "opsPerSecond": 1234,
      "hitRate": 95.5,
      "keyspaceHits": 15000,
      "keyspaceMisses": 700
    }
  }
}
```

---

## Production Deployment

### High Availability Options

#### 1. Redis Sentinel

```yaml
# docker-compose for Sentinel
services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes

  redis-slave:
    image: redis:7-alpine
    command: redis-server --slaveof redis-master 6379

  sentinel1:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
```

#### 2. Redis Cluster

```yaml
services:
  redis-node-1:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes

  redis-node-2:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes

  redis-node-3:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes
```

### Memory Management

```bash
# Set max memory limit
redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru
```

### Persistence

- **RDB (Snapshots)**: Good for backup, less data loss tolerance
- **AOF (Append Only File)**: Better durability, larger files
- **Hybrid**: AOF for durability + RDB for faster restarts

```bash
# Enable both AOF and RDB
redis-server --appendonly yes --save 60 1000
```

---

## Troubleshooting

### Common Issues

#### 1. Connection Refused

```bash
# Check if Redis is running
docker ps | grep redis
redis-cli ping

# Check logs
docker logs valorhive-redis
```

#### 2. High Memory Usage

```bash
# Check memory usage
redis-cli info memory

# Find large keys
redis-cli --bigkeys

# Clear cache (use with caution)
redis-cli flushdb
```

#### 3. Slow Performance

```bash
# Check slow log
redis-cli slowlog get 10

# Monitor commands in real-time
redis-cli monitor
```

### Debug Mode

Enable cache debug logging:

```bash
CACHE_DEBUG=true bun run dev
```

This will log all cache operations:
```
[Cache] HIT: valorhive:lb:CORNHOLE:national
[Cache] MISS: valorhive:ps:CORNHOLE:user123
[Cache] SET: valorhive:lb:CORNHOLE:national (TTL: 5s)
[Cache] DELETE PATTERN: valorhive:lb:CORNHOLE:* (15 keys)
```

### Cache Statistics

```typescript
import { getCacheStats } from '@/lib/cache';

const stats = await getCacheStats();
console.log(stats);
// {
//   type: 'redis',
//   hits: 15000,
//   misses: 700,
//   hitRate: 95.5,
//   keys: 234,
//   memoryUsage: '12.5 MB'
// }
```

---

## Best Practices

1. **Always use TTL** - Never cache data without an expiration time
2. **Use appropriate TTLs** - Match TTL to data freshness requirements
3. **Handle cache failures** - Always have a fallback to database
4. **Invalidate on write** - Clear cache when underlying data changes
5. **Use patterns for bulk invalidation** - `deletePattern()` for related keys
6. **Monitor hit rate** - Target >80% for frequently accessed data
7. **Warm cache on startup** - Pre-populate frequently accessed data
8. **Use Redis for sessions in production** - Reduces database load

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/lib/cache.ts` | Main cache service with specialized caches |
| `src/lib/redis-config.ts` | Redis connection configuration |
| `src/lib/redis-health.ts` | Health monitoring utilities |
| `src/lib/session-cache.ts` | Session caching layer |
| `src/lib/cache-invalidation.ts` | Automatic cache invalidation |
| `src/lib/distributed-rate-limit.ts` | Redis-backed rate limiting |
| `src/app/api/health/redis/route.ts` | Redis health endpoint |
| `docker-compose.yml` | Production Docker setup |
| `docker-compose.dev.yml` | Development Docker setup |
