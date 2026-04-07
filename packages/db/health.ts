/**
 * @valorhive/db - Health Check Functions
 * 
 * Database health monitoring and utility functions.
 */

import { db } from './client';

/**
 * Graceful shutdown helper
 * Call this when shutting down the application
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await db.$disconnect();
    console.log('[Database] Disconnected successfully');
  } catch (error) {
    console.error('[Database] Error disconnecting:', error);
    throw error;
  }
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    // Simple query to check connection
    await db.$queryRaw`SELECT 1`;

    return {
      healthy: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get database connection stats (for monitoring)
 */
export async function getConnectionStats(): Promise<{
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
}> {
  // This is a placeholder for PostgreSQL connection stats
  // In production, you would query pg_stat_activity
  return {
    activeConnections: 0,
    idleConnections: 0,
    totalConnections: 0,
  };
}
