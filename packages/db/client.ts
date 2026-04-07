/**
 * @valorhive/db - Prisma Client
 * 
 * Database client initialization for VALORHIVE services.
 * This is the single source of truth for database connections.
 */

import { Prisma, PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma client configuration
const prismaClientOptions: Prisma.PrismaClientOptions = {
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
  // Connection pool settings for PostgreSQL
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};

// Create Prisma client with optimized settings
export const db =
  globalForPrisma.prisma ??
  new PrismaClient(prismaClientOptions);

// Prevent multiple instances in development
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

/**
 * ============================================================
 * DATABASE CONFIGURATION GUIDE
 * ============================================================
 * 
 * ## CURRENT: SQLite (Development)
 * - Simple file-based storage
 * - No connection pooling needed (single connection)
 * - No read replica support
 * - Good for: Development, testing, small deployments
 * 
 * ## PRODUCTION: PostgreSQL Migration Required
 * 
 * ### 1. Connection Pooling with PgBouncer
 * 
 * Set DATABASE_URL to PgBouncer port (6432):
 *    DATABASE_URL="postgresql://user:password@localhost:6432/valorhive?schema=public&pgbouncer=true"
 * 
 * Set DIRECT_URL for migrations (bypasses PgBouncer):
 *    DIRECT_URL="postgresql://user:password@localhost:5432/valorhive?schema=public"
 * 
 * Update prisma/schema.prisma:
 *    datasource db {
 *      provider = "postgresql"
 *      url      = env("DATABASE_URL")
 *      directUrl = env("DIRECT_URL")
 *    }
 * 
 * PgBouncer Configuration (config/pgbouncer.ini):
 * - pool_mode: transaction (recommended for web apps)
 * - max_client_conn: 500
 * - default_pool_size: 25
 * - server_idle_timeout: 600
 * 
 * ### 2. Read Replicas (Prisma 7+ with PostgreSQL)
 * 
 * Read replicas distribute read-heavy queries (leaderboards, brackets)
 * to replica databases, reducing load on the primary database.
 * 
 * NOTE: Read replicas require PostgreSQL - NOT supported with SQLite!
 * 
 * Setup with Prisma 7+:
 * 
 * ```typescript
 * import { PrismaClient } from '@prisma/client'
 * import { readReplicas } from '@prisma/extension-read-replicas'
 * import { PrismaPg } from '@prisma/adapter-pg'
 * 
 * // Main database adapter
 * const mainAdapter = new PrismaPg({ 
 *   connectionString: process.env.DATABASE_URL 
 * })
 * 
 * // Replica database adapter
 * const replicaAdapter = new PrismaPg({ 
 *   connectionString: process.env.DATABASE_URL_REPLICA 
 * })
 * 
 * // Create main client first
 * const mainClient = new PrismaClient({ adapter: mainAdapter })
 * 
 * // Create replica client
 * const replicaClient = new PrismaClient({ adapter: replicaAdapter })
 * 
 * // Apply readReplicas extension LAST
 * export const db = mainClient.$extends(
 *   readReplicas({ replicas: [replicaClient] })
 * )
 * ```
 * 
 * Environment Variables for Read Replicas:
 *    DATABASE_URL="postgresql://user:pass@primary-host:5432/valorhive"
 *    REPLICA_URL="postgresql://user:pass@replica-host:5432/valorhive"
 * 
 * Read Replica Use Cases in VALORHIVE:
 * - Leaderboard queries (high read volume)
 * - Bracket data retrieval (tournament viewers)
 * - Player profile views (public pages)
 * - Tournament listings (browse pages)
 * 
 * ### 3. Connection Pool Benefits
 * - Reduced database connections
 * - Better connection reuse
 * - Improved performance under load
 * - Protection against connection spikes
 */
