/**
 * AWS CloudWatch Metrics Integration
 * 
 * Publishes custom metrics to AWS CloudWatch for production monitoring.
 * 
 * @module lib/cloudwatch-metrics
 */

import { CloudWatchClient, PutMetricDataCommand, Dimension, StandardUnit } from '@aws-sdk/client-cloudwatch';
import { metrics, getJsonMetrics } from './metrics';

// ============================================
// Configuration
// ============================================

const awsRegion = process.env.AWS_REGION || 'ap-south-1';
const namespace = process.env.CLOUDWATCH_NAMESPACE || 'VALORHIVE';
const enabled = process.env.METRICS_ENABLED === 'true' && process.env.METRICS_PROVIDER === 'cloudwatch';
const exportInterval = parseInt(process.env.METRICS_EXPORT_INTERVAL || '60000', 10);

let cloudWatchClient: CloudWatchClient | null = null;
let exportTimer: NodeJS.Timeout | null = null;

// ============================================
// Client Initialization
// ============================================

function getClient(): CloudWatchClient | null {
  if (!cloudWatchClient && enabled) {
    try {
      cloudWatchClient = new CloudWatchClient({ region: awsRegion });
      console.log('[CloudWatch] Client initialized');
    } catch (error) {
      console.error('[CloudWatch] Failed to initialize client:', error);
    }
  }
  return cloudWatchClient;
}

// ============================================
// Metrics Publishing
// ============================================

/**
 * Publish metrics to CloudWatch
 */
export async function publishToCloudWatch(): Promise<void> {
  const client = getClient();
  if (!client) return;
  
  const jsonMetrics = await getJsonMetrics();
  if (jsonMetrics.length === 0) return;
  
  // Group metrics by name for batch publishing
  const metricsByName = new Map<string, typeof jsonMetrics>();
  for (const metric of jsonMetrics) {
    const existing = metricsByName.get(metric.name) || [];
    existing.push(metric);
    metricsByName.set(metric.name, existing);
  }
  
  // Build CloudWatch metric data
  const metricData = Array.from(metricsByName.entries()).map(([name, values]) => ({
    MetricName: name.replace('valorhive_', ''),
    Dimensions: buildDimensions(values[0].labels),
    Value: values.reduce((sum, v) => sum + v.value, 0) / values.length, // Average
    Unit: 'Count' as StandardUnit,
    Timestamp: new Date(),
  }));
  
  // Publish in batches of 20 (CloudWatch limit)
  const batchSize = 20;
  for (let i = 0; i < metricData.length; i += batchSize) {
    const batch = metricData.slice(i, i + batchSize);
    
    try {
      await client.send(new PutMetricDataCommand({
        Namespace: namespace,
        MetricData: batch,
      }));
    } catch (error) {
      console.error('[CloudWatch] Failed to publish metrics:', error);
    }
  }
}

/**
 * Build CloudWatch dimensions from labels
 */
function buildDimensions(labels: Record<string, string | number>): Dimension[] {
  return Object.entries(labels)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([Name, Value]) => ({
      Name,
      Value: String(Value),
    }));
}

/**
 * Publish a single custom metric
 */
export async function publishMetric(
  metricName: string,
  value: number,
  unit: StandardUnit = 'Count',
  dimensions: Record<string, string> = {}
): Promise<void> {
  const client = getClient();
  if (!client) return;
  
  try {
    await client.send(new PutMetricDataCommand({
      Namespace: namespace,
      MetricData: [{
        MetricName: metricName,
        Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value })),
        Value: value,
        Unit: unit,
        Timestamp: new Date(),
      }],
    }));
  } catch (error) {
    console.error('[CloudWatch] Failed to publish metric:', error);
  }
}

// ============================================
// Scheduled Export
// ============================================

/**
 * Start periodic metrics export to CloudWatch
 */
export function startCloudWatchExport(): void {
  if (!enabled) {
    console.log('[CloudWatch] Metrics export disabled');
    return;
  }
  
  if (exportTimer) {
    console.log('[CloudWatch] Export already running');
    return;
  }
  
  console.log(`[CloudWatch] Starting metrics export every ${exportInterval}ms`);
  
  exportTimer = setInterval(async () => {
    try {
      await publishToCloudWatch();
    } catch (error) {
      console.error('[CloudWatch] Export failed:', error);
    }
  }, exportInterval);
  
  // Also publish on process exit
  process.on('beforeExit', async () => {
    if (exportTimer) {
      clearInterval(exportTimer);
      await publishToCloudWatch();
    }
  });
}

/**
 * Stop metrics export
 */
export function stopCloudWatchExport(): void {
  if (exportTimer) {
    clearInterval(exportTimer);
    exportTimer = null;
    console.log('[CloudWatch] Metrics export stopped');
  }
}

// ============================================
// Predefined Metric Helpers
// ============================================

/**
 * Track API latency
 */
export async function trackApiLatency(
  endpoint: string,
  method: string,
  latencyMs: number
): Promise<void> {
  await publishMetric('ApiLatency', latencyMs, 'Milliseconds', {
    endpoint,
    method,
  });
}

/**
 * Track tournament registration
 */
export async function trackTournamentRegistration(
  sport: string,
  scope: string
): Promise<void> {
  await publishMetric('TournamentRegistration', 1, 'Count', {
    sport,
    scope,
  });
}

/**
 * Track match completion
 */
export async function trackMatchCompletion(
  sport: string,
  tournamentType: string
): Promise<void> {
  await publishMetric('MatchCompleted', 1, 'Count', {
    sport,
    tournamentType,
  });
}

/**
 * Track payment success
 */
export async function trackPaymentSuccess(
  amount: number,
  currency: string = 'INR'
): Promise<void> {
  await publishMetric('PaymentSuccess', amount / 100, 'Count', { // Convert paise to rupees
    currency,
  });
}

/**
 * Track error
 */
export async function trackError(
  errorType: string,
  endpoint: string
): Promise<void> {
  await publishMetric('Error', 1, 'Count', {
    errorType,
    endpoint,
  });
}

/**
 * Get CloudWatch status
 */
export function getCloudWatchStatus(): {
  enabled: boolean;
  region: string;
  namespace: string;
  connected: boolean;
} {
  return {
    enabled,
    region: awsRegion,
    namespace,
    connected: cloudWatchClient !== null,
  };
}

export default {
  publishToCloudWatch,
  publishMetric,
  startCloudWatchExport,
  stopCloudWatchExport,
  trackApiLatency,
  trackTournamentRegistration,
  trackMatchCompletion,
  trackPaymentSuccess,
  trackError,
  getCloudWatchStatus,
};
