/**
 * OpenTelemetry Distributed Tracing for VALORHIVE
 * 
 * This module provides comprehensive distributed tracing across services:
 * - NodeTracerProvider setup with OTLP exporter
 * - Console exporter for development
 * - Auto-instrumentation for HTTP, Prisma (pg), Redis (ioredis)
 * - Helper functions for tracing key operations
 * - Request ID propagation and correlation
 * 
 * Environment Variables:
 * - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP endpoint URL (e.g., http://localhost:4318/v1/traces)
 * - OTEL_SERVICE_NAME: Service name (default: valorhive-api)
 * - OTEL_TRACES_ENABLED: Enable/disable tracing (default: true in production)
 * - OTEL_EXPORTER_OTLP_HEADERS: Optional headers for OTLP exporter
 * 
 * @module tracing
 */

import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor, ConsoleSpanExporter, SimpleSpanProcessor, Span, SpanStatusCode, Tracer } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { context, Context, propagation, Span as OTSpan, trace, TraceFlags, ContextManager } from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

// ============================================
// Types and Interfaces
// ============================================

export interface TracingConfig {
  enabled: boolean;
  serviceName: string;
  otlpEndpoint?: string;
  otlpHeaders?: Record<string, string>;
  consoleExporter: boolean;
}

export interface SpanAttributes {
  userId?: string;
  orgId?: string;
  sport?: string;
  tournamentId?: string;
  matchId?: string;
  requestId?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface TraceResult<T> {
  result: T;
  span: Span;
}

// ============================================
// Configuration
// ============================================

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

function getTracingConfig(): TracingConfig {
  const enabled = process.env.OTEL_TRACES_ENABLED 
    ? process.env.OTEL_TRACES_ENABLED === 'true'
    : isProduction; // Default: true in production
  
  return {
    enabled,
    serviceName: process.env.OTEL_SERVICE_NAME || 'valorhive-api',
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    otlpHeaders: process.env.OTEL_EXPORTER_OTLP_HEADERS 
      ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
      : undefined,
    consoleExporter: isDevelopment && process.env.OTEL_CONSOLE_EXPORTER !== 'false',
  };
}

// ============================================
// Tracer Provider Singleton
// ============================================

let provider: NodeTracerProvider | null = null;
let tracer: Tracer | null = null;
let isInitialized = false;

/**
 * Initialize the OpenTelemetry tracing provider
 * This should be called once at application startup
 */
export async function initializeTracing(): Promise<NodeTracerProvider | null> {
  if (isInitialized) {
    return provider;
  }

  const config = getTracingConfig();

  if (!config.enabled) {
    console.log('[Tracing] Tracing is disabled');
    isInitialized = true;
    return null;
  }

  try {
    // Create resource with service attributes
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'valorhive',
    });

    // Create provider
    provider = new NodeTracerProvider({ resource });

    // Add OTLP exporter if endpoint is configured
    if (config.otlpEndpoint) {
      const otlpExporter = new OTLPTraceExporter({
        url: config.otlpEndpoint,
        headers: config.otlpHeaders,
      });
      provider.addSpanProcessor(new BatchSpanProcessor(otlpExporter));
      console.log(`[Tracing] OTLP exporter configured: ${config.otlpEndpoint}`);
    }

    // Add console exporter in development
    if (config.consoleExporter) {
      const consoleExporter = new ConsoleSpanExporter();
      provider.addSpanProcessor(new SimpleSpanProcessor(consoleExporter));
      console.log('[Tracing] Console exporter enabled');
    }

    // Register the provider
    provider.register();

    // Set up context manager
    const contextManager = new AsyncHooksContextManager();
    contextManager.enable();
    context.setGlobalContextManager(contextManager as unknown as ContextManager);

    // Register auto-instrumentations
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation({
          // Ignore health check and internal routes
          ignoreIncomingRequestHook: (request) => {
            const url = request.url || '';
            return url.includes('/health') || url.includes('/metrics');
          },
          requestHook: (span, request) => {
            // Add request attributes
            span.setAttribute('http.request.id', generateRequestId());
          },
        }),
        new PgInstrumentation({
          // Enhanced database query tracing
          enhanceDatabaseReporting: true,
        }),
        new IORedisInstrumentation({
          // Enhanced Redis tracing
        }),
      ],
      tracerProvider: provider,
    });

    // Get tracer
    tracer = provider.getTracer(config.serviceName);

    isInitialized = true;
    console.log('[Tracing] OpenTelemetry initialized successfully');

    return provider;
  } catch (error) {
    console.error('[Tracing] Failed to initialize OpenTelemetry:', error);
    // Graceful degradation - continue without tracing
    isInitialized = true;
    return null;
  }
}

/**
 * Get the tracer instance
 */
export function getTracer(): Tracer {
  if (!tracer) {
    // Return a no-op tracer if not initialized
    return trace.getTracer('valorhive-api');
  }
  return tracer;
}

/**
 * Check if tracing is enabled
 */
export function isTracingEnabled(): boolean {
  const config = getTracingConfig();
  return config.enabled && isInitialized && provider !== null;
}

/**
 * Shutdown the tracing provider
 * Should be called during application shutdown
 */
export async function shutdownTracing(): Promise<void> {
  if (provider) {
    try {
      await provider.shutdown();
      console.log('[Tracing] Provider shutdown complete');
    } catch (error) {
      console.error('[Tracing] Error during shutdown:', error);
    }
    provider = null;
    tracer = null;
    isInitialized = false;
  }
}

// ============================================
// Request ID Generation and Propagation
// ============================================

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Extract trace context from request headers
 */
export function extractTraceContext(request: NextRequest): Context {
  const traceparent = request.headers.get('traceparent');
  const tracestate = request.headers.get('tracestate');
  
  if (traceparent) {
    // Create a context from the traceparent header
    const headers: Record<string, string> = {
      traceparent,
    };
    if (tracestate) {
      headers.tracestate = tracestate;
    }
    
    return propagation.extract(context.active(), headers);
  }
  
  return context.active();
}

/**
 * Inject trace context into headers for outgoing requests
 */
export function injectTraceContext(headers: Record<string, string> = {}): Record<string, string> {
  propagation.inject(context.active(), headers);
  return headers;
}

/**
 * Get the current trace ID from the active span
 */
export function getCurrentTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  if (span) {
    return span.spanContext().traceId;
  }
  return undefined;
}

/**
 * Get the current span ID from the active span
 */
export function getCurrentSpanId(): string | undefined {
  const span = trace.getActiveSpan();
  if (span) {
    return span.spanContext().spanId;
  }
  return undefined;
}

// ============================================
// Tracing Helper Functions
// ============================================

/**
 * Start a new span with the given name
 */
export function startSpan(
  name: string,
  options: {
    kind?: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
    attributes?: SpanAttributes;
    parentContext?: Context;
  } = {}
): Span {
  const tracerInstance = getTracer();
  
  const kindMap = {
    internal: 0, // SpanKind.INTERNAL
    server: 1,   // SpanKind.SERVER
    client: 2,   // SpanKind.CLIENT
    producer: 3, // SpanKind.PRODUCER
    consumer: 4, // SpanKind.CONSUMER
  };
  
  const span = tracerInstance.startSpan(name, {
    kind: kindMap[options.kind || 'internal'],
    attributes: flattenAttributes(options.attributes),
  }, options.parentContext);
  
  return span as unknown as Span;
}

/**
 * Execute a function within a traced span
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options: {
    kind?: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
    attributes?: SpanAttributes;
    parentContext?: Context;
  } = {}
): Promise<T> {
  if (!isTracingEnabled()) {
    return fn({} as Span); // No-op span
  }
  
  const span = startSpan(name, options);
  
  try {
    const result = await context.with(
      trace.setSpan(context.active(), span as unknown as OTSpan),
      () => fn(span)
    );
    
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Execute a synchronous function within a traced span
 */
export function withSpanSync<T>(
  name: string,
  fn: (span: Span) => T,
  options: {
    kind?: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
    attributes?: SpanAttributes;
  } = {}
): T {
  if (!isTracingEnabled()) {
    return fn({} as Span); // No-op span
  }
  
  const span = startSpan(name, options);
  
  try {
    const result = context.with(
      trace.setSpan(context.active(), span as unknown as OTSpan),
      () => fn(span)
    );
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Set attributes on the current active span
 */
export function setSpanAttributes(attributes: SpanAttributes): void {
  const span = trace.getActiveSpan();
  if (span) {
    const flatAttrs = flattenAttributes(attributes);
    Object.entries(flatAttrs).forEach(([key, value]) => {
      if (value !== undefined) {
        span.setAttribute(key, value);
      }
    });
  }
}

/**
 * Add an event to the current active span
 */
export function addSpanEvent(name: string, attributes?: SpanAttributes): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, flattenAttributes(attributes));
  }
}

/**
 * Record an exception on the current active span
 */
export function recordException(error: Error): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }
}

// ============================================
// Operation-Specific Tracing Functions
// ============================================

/**
 * Trace authentication operations
 */
export async function traceAuthOperation<T>(
  operation: 'login' | 'register' | 'logout' | 'validate_session' | 'refresh_token' | 'mfa_verify',
  fn: (span: Span) => Promise<T>,
  metadata: {
    userId?: string;
    sport?: string;
    method?: 'email' | 'phone' | 'google' | 'bearer';
    ip?: string;
    userAgent?: string;
  } = {}
): Promise<T> {
  return withSpan(`auth.${operation}`, fn, {
    kind: 'server',
    attributes: {
      'auth.operation': operation,
      'auth.method': metadata.method,
      'user.id': metadata.userId,
      'sport': metadata.sport,
      'client.ip': metadata.ip,
      'user.agent': metadata.userAgent,
    },
  });
}

/**
 * Trace database queries
 */
export async function traceDatabaseQuery<T>(
  operation: string,
  fn: (span: Span) => Promise<T>,
  metadata: {
    table?: string;
    action?: 'create' | 'read' | 'update' | 'delete' | 'count';
    userId?: string;
    orgId?: string;
  } = {}
): Promise<T> {
  return withSpan(`db.${operation}`, fn, {
    kind: 'client',
    attributes: {
      'db.system': 'postgresql',
      'db.operation': operation,
      'db.table': metadata.table,
      'db.action': metadata.action,
      'user.id': metadata.userId,
      'org.id': metadata.orgId,
    },
  });
}

/**
 * Trace API requests
 */
export async function traceApiRequest<T>(
  endpoint: string,
  fn: (span: Span) => Promise<T>,
  metadata: {
    method?: string;
    userId?: string;
    orgId?: string;
    sport?: string;
    requestId?: string;
  } = {}
): Promise<T> {
  return withSpan(`api.${endpoint}`, fn, {
    kind: 'server',
    attributes: {
      'http.endpoint': endpoint,
      'http.method': metadata.method,
      'user.id': metadata.userId,
      'org.id': metadata.orgId,
      'sport': metadata.sport,
      'request.id': metadata.requestId,
    },
  });
}

/**
 * Trace job queue operations
 */
export async function traceQueueJob<T>(
  queueName: string,
  jobType: string,
  fn: (span: Span) => Promise<T>,
  metadata: {
    jobId?: string;
    userId?: string;
    orgId?: string;
    tournamentId?: string;
    attempt?: number;
  } = {}
): Promise<T> {
  return withSpan(`job.${queueName}.${jobType}`, fn, {
    kind: 'consumer',
    attributes: {
      'job.queue': queueName,
      'job.type': jobType,
      'job.id': metadata.jobId,
      'job.attempt': metadata.attempt,
      'user.id': metadata.userId,
      'org.id': metadata.orgId,
      'tournament.id': metadata.tournamentId,
    },
  });
}

/**
 * Trace external service calls
 */
export async function traceExternalCall<T>(
  service: string,
  operation: string,
  fn: (span: Span) => Promise<T>,
  metadata: {
    url?: string;
    method?: string;
  } = {}
): Promise<T> {
  return withSpan(`external.${service}.${operation}`, fn, {
    kind: 'client',
    attributes: {
      'external.service': service,
      'external.operation': operation,
      'http.url': metadata.url,
      'http.method': metadata.method,
    },
  });
}

// ============================================
// Utility Functions
// ============================================

/**
 * Flatten nested attributes for OpenTelemetry compatibility
 */
function flattenAttributes(
  attributes?: SpanAttributes
): Record<string, string | number | boolean> {
  if (!attributes) return {};
  
  const result: Record<string, string | number | boolean> = {};
  
  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      result[key] = value as string | number | boolean;
    }
  });
  
  return result;
}

/**
 * Create a child span from the current span
 */
export function createChildSpan(
  name: string,
  attributes?: SpanAttributes
): Span {
  const parentSpan = trace.getActiveSpan();
  
  if (!parentSpan) {
    return startSpan(name, { attributes });
  }
  
  const tracerInstance = getTracer();
  const span = tracerInstance.startSpan(name, {
    attributes: flattenAttributes(attributes),
  });
  
  return span as unknown as Span;
}

/**
 * Wrap an async function with tracing
 * Useful for decorating class methods or function exports
 */
export function traced<T extends (...args: unknown[]) => Promise<unknown>>(
  name: string,
  fn: T,
  options: {
    kind?: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
    getAttributes?: (...args: Parameters<T>) => SpanAttributes;
  } = {}
): T {
  return (async (...args: Parameters<T>) => {
    const attributes = options.getAttributes ? options.getAttributes(...args) : {};
    return withSpan(name, () => fn(...args) as Promise<unknown>, {
      kind: options.kind,
      attributes,
    });
  }) as T;
}

// ============================================
// Exports for External Use
// ============================================

export {
  SpanStatusCode,
  SpanKind,
} from '@opentelemetry/api';
