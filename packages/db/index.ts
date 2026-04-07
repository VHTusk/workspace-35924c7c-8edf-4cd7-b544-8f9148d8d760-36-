/**
 * @valorhive/db
 * 
 * Database module for VALORHIVE services.
 * Self-contained Prisma client with health check utilities.
 * 
 * @example
 * // In a mini-service
 * import { db, checkDatabaseHealth } from '@valorhive/db';
 * 
 * // Query the database
 * const user = await db.user.findUnique({ where: { id } });
 * 
 * // Health check
 * const health = await checkDatabaseHealth();
 */

import { Prisma, PrismaClient } from '@prisma/client';

// ============================================
// Prisma Client Singleton
// ============================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma client configuration
const prismaClientOptions: Prisma.PrismaClientOptions = {
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
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

// ============================================
// Health & Utility Functions
// ============================================

/**
 * Disconnect from the database gracefully
 */
export async function disconnectDatabase(): Promise<void> {
  await db.$disconnect();
}

/**
 * Check database health
 * Returns health status and connection info
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return {
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get connection statistics
 */
export async function getConnectionStats(): Promise<{
  activeConnections: number;
  maxConnections: number;
}> {
  // SQLite doesn't have connection pooling
  // Return defaults for compatibility
  return {
    activeConnections: 1,
    maxConnections: 1,
  };
}

// ============================================
// Re-export Prisma Types
// ============================================

// Re-export commonly used Prisma types for convenience
export type {
  User,
  Session,
  Tournament,
  Match,
  Organization,
  SportType,
  Role,
  TournamentStatus,
} from '@prisma/client';
