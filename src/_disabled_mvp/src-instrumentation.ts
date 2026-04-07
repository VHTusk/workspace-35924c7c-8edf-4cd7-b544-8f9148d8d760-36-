/**
 * Next.js Instrumentation for Production Infrastructure
 * 
 * This file is automatically loaded by Next.js during server startup.
 * It initializes:
 * - OpenTelemetry tracing (OPTIONAL - requires OTEL_TRACES_ENABLED=true)
 * - Event Bus and Workers (OPTIONAL - requires EVENT_BUS_ENABLED=true)
 * - Background services
 * 
 * The instrumentation runs in a Node.js environment (not Edge Runtime).
 * All components are optional and gracefully degrade if disabled or unavailable.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

// Track initialization state for idempotent shutdown
let tracingInitialized = false;
let eventBusInitialized = false;
let shutdownHandlersRegistered = false;

/**
 * Register function called by Next.js during startup
 * All initialization is guarded by environment flags for safe local development
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // ============================================
    // OPTIONAL: OpenTelemetry Tracing
    // Enabled when OTEL_TRACES_ENABLED=true or in production with OTLP endpoint
    // Gracefully skips if disabled or if no endpoint is configured
    // ============================================
    const tracingEnabled = process.env.OTEL_TRACES_ENABLED === 'true' || 
      (process.env.NODE_ENV === 'production' && process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
    
    if (tracingEnabled) {
      try {
        const { initializeTracing } = await import('@/lib/tracing');
        await initializeTracing();
        tracingInitialized = true;
        console.log('[Instrumentation] OpenTelemetry tracing registered');
      } catch (error) {
        // Graceful degradation - continue without tracing
        console.warn('[Instrumentation] OpenTelemetry tracing unavailable (optional):', 
          error instanceof Error ? error.message : 'Unknown error');
      }
    } else {
      console.log('[Instrumentation] OpenTelemetry tracing skipped (not enabled)');
    }
    
    // Event bus is disabled for the MVP deploy path.
    console.log('[Instrumentation] Event bus skipped for MVP deployment');
    
    // ============================================
    // Shutdown Handlers (register only once)
    // Gracefully tears down initialized components on SIGTERM/SIGINT
    // ============================================
    if (!shutdownHandlersRegistered) {
      shutdownHandlersRegistered = true;
      
      process.on('SIGTERM', async () => {
        console.log('[Instrumentation] Received SIGTERM, shutting down...');
        await performShutdown();
      });
      
      process.on('SIGINT', async () => {
        console.log('[Instrumentation] Received SIGINT, shutting down...');
        await performShutdown();
      });
    }
    
    console.log('[Instrumentation] Server initialization complete');
  }
}

/**
 * Unregister function for cleanup (optional)
 * Called during hot reload in development
 * Safe to call multiple times - idempotent shutdown
 */
export async function unregister() {
  await performShutdown();
  console.log('[Instrumentation] Server unregistered');
}

/**
 * Perform graceful shutdown of all initialized components
 * Idempotent - safe to call multiple times
 */
async function performShutdown(): Promise<void> {
  eventBusInitialized = false;
  
  // Shutdown tracing last (flushes pending spans)
  if (tracingInitialized) {
    try {
      const { shutdownTracing } = await import('@/lib/tracing');
      await shutdownTracing();
      tracingInitialized = false;
      console.log('[Instrumentation] Tracing shutdown complete');
    } catch (error) {
      console.warn('[Instrumentation] Error shutting down tracing:', 
        error instanceof Error ? error.message : 'Unknown error');
    }
  }
}
