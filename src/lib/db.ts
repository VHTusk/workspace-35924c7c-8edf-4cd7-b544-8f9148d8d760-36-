import { Prisma, PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

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
}

// Create Prisma client with optimized settings
export const db =
  globalForPrisma.prisma ??
  new PrismaClient(prismaClientOptions)

// Prevent multiple instances in development
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * ============================================================
 * DATABASE CONFIGURATION GUIDE
 * ============================================================
 * 
 * ## CURRENT: PostgreSQL
 * - Uses DATABASE_URL for local and production environments
 * - Good for: Docker-based local development and Railway deployment
 * 
 * ## PRODUCTION: PostgreSQL with optional pooling
 * 
 * ### 1. Connection Pooling with PgBouncer
 * 
 * Set DATABASE_URL to PgBouncer port (6432):
 *    DATABASE_URL="postgresql://user:password@DB_HOST:6432/valorhive?schema=public&pgbouncer=true"
 * 
 * Update prisma/schema.prisma:
 *    datasource db {
 *      provider = "postgresql"
 *      url      = env("DATABASE_URL")
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
 * NOTE: Read replicas require PostgreSQL.
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
 * // ⚠️ IMPORTANT: Apply readReplicas extension LAST (after any other extensions)
 * // If using other extensions (e.g., $extends(withResultExtension)), apply them first,
 * // then apply readReplicas as the final extension.
 * export const db = mainClient.$extends(
 *   readReplicas({ replicas: [replicaClient] })
 * )
 * 
 * // Usage: Read queries automatically route to replicas
 * // Write queries always go to primary
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

/**
 * Graceful shutdown helper
 * Call this when shutting down the application
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await db.$disconnect()
    console.log('[Database] Disconnected successfully')
  } catch (error) {
    console.error('[Database] Error disconnecting:', error)
    throw error
  }
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean
  latency?: number
  error?: string
}> {
  const start = Date.now()
  
  try {
    // Simple query to check connection
    await db.$queryRaw`SELECT 1`
    
    return {
      healthy: true,
      latency: Date.now() - start,
    }
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get database connection stats (for monitoring)
 */
export async function getConnectionStats(): Promise<{
  activeConnections: number
  idleConnections: number
  totalConnections: number
}> {
  // This is a placeholder for PostgreSQL connection stats
  // In production, you would query pg_stat_activity
  return {
    activeConnections: 0,
    idleConnections: 0,
    totalConnections: 0,
  }
}
