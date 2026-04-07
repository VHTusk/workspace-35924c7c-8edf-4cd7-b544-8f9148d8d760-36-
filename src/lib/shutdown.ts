/**
 * Graceful Shutdown Handler for VALORHIVE
 * 
 * Features:
 * - Handle SIGTERM, SIGINT signals
 * - Drain active connections
 * - Complete in-flight requests
 * - Close database connections
 * - Log shutdown events
 */

import { db } from './db';

type ShutdownHook = () => Promise<void>;

interface ShutdownState {
  isShuttingDown: boolean;
  activeConnections: number;
  inFlightRequests: number;
}

const state: ShutdownState = {
  isShuttingDown: false,
  activeConnections: 0,
  inFlightRequests: 0,
};

// Shutdown hooks registry
const shutdownHooks: ShutdownHook[] = [];

// Shutdown timeout (force exit after this)
const SHUTDOWN_TIMEOUT_MS = 30 * 1000; // 30 seconds

/**
 * Register a shutdown hook
 */
export function registerShutdownHook(hook: ShutdownHook): void {
  shutdownHooks.push(hook);
}

/**
 * Track active connection
 */
export function trackConnection(): () => void {
  state.activeConnections++;
  return () => {
    state.activeConnections--;
  };
}

/**
 * Track in-flight request
 */
export function trackRequest(): () => void {
  state.inFlightRequests++;
  return () => {
    state.inFlightRequests--;
  };
}

/**
 * Check if server is shutting down
 */
export function isShuttingDown(): boolean {
  return state.isShuttingDown;
}

/**
 * Get current state
 */
export function getShutdownState(): ShutdownState {
  return { ...state };
}

/**
 * Log shutdown event
 */
function log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [Shutdown] ${message}`;
  
  switch (level) {
    case 'error':
      console.error(logMessage);
      break;
    case 'warn':
      console.warn(logMessage);
      break;
    default:
      console.log(logMessage);
  }
}

/**
 * Execute graceful shutdown
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (state.isShuttingDown) {
    log('Already shutting down, ignoring signal', 'warn');
    return;
  }

  state.isShuttingDown = true;
  log(`Received ${signal}, starting graceful shutdown...`);

  // Set force exit timeout
  const forceExitTimeout = setTimeout(() => {
    log('Shutdown timeout exceeded, forcing exit', 'error');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    // Wait for in-flight requests to complete (with timeout)
    const drainStartTime = Date.now();
    const maxDrainTime = 10 * 1000; // 10 seconds to drain

    while (state.inFlightRequests > 0 || state.activeConnections > 0) {
      if (Date.now() - drainStartTime > maxDrainTime) {
        log(`Drain timeout exceeded. Remaining: ${state.inFlightRequests} requests, ${state.activeConnections} connections`, 'warn');
        break;
      }

      log(`Waiting for ${state.inFlightRequests} requests and ${state.activeConnections} connections to drain...`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    log('All connections drained');

    // Execute shutdown hooks in order
    log(`Executing ${shutdownHooks.length} shutdown hooks...`);
    for (let i = 0; i < shutdownHooks.length; i++) {
      try {
        await shutdownHooks[i]();
        log(`Hook ${i + 1}/${shutdownHooks.length} completed`);
      } catch (error) {
        log(`Hook ${i + 1} failed: ${error}`, 'error');
      }
    }

    // Disconnect database
    try {
      await db.$disconnect();
      log('Database disconnected');
    } catch (error) {
      log(`Database disconnect error: ${error}`, 'warn');
    }

    clearTimeout(forceExitTimeout);
    log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    log(`Shutdown error: ${error}`, 'error');
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
}

/**
 * Initialize shutdown handlers
 */
export function initializeShutdownHandlers(): void {
  // Only run in Node.js environment (not in Edge runtime)
  if (typeof process === 'undefined' || !process.on) {
    return;
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    log(`Uncaught exception: ${error}`, 'error');
    gracefulShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    log(`Unhandled rejection at: ${promise}, reason: ${reason}`, 'error');
  });

  log('Shutdown handlers initialized');
}

/**
 * Health check with shutdown awareness
 */
export function getHealthStatus(): {
  healthy: boolean;
  shuttingDown: boolean;
  activeConnections: number;
  inFlightRequests: number;
} {
  return {
    healthy: !state.isShuttingDown,
    shuttingDown: state.isShuttingDown,
    activeConnections: state.activeConnections,
    inFlightRequests: state.inFlightRequests,
  };
}

// Auto-initialize on import in server environment
if (typeof window === 'undefined') {
  initializeShutdownHandlers();
}
