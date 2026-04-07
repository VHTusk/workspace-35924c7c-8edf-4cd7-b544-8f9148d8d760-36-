/**
 * VALORHIVE Load Testing - Spike Test
 * 
 * Tests system response to sudden traffic bursts.
 * - Simulates viral content or event start
 * - Rapid ramp up and down
 * - Tests auto-scaling response
 * 
 * Run with: k6 run tests/load/spike.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';
import { config, getFullUrl, think, log } from '../synthetic/config.js';

// Custom metrics
const successfulRequests = new Rate('successful_requests');
const responseTimeTrend = new Trend('response_time');
const droppedRequests = new Counter('dropped_requests');
const recoveredRequests = new Rate('recovered_requests');

// Test configuration - Spike test
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Normal load
    { duration: '10s', target: 500 },  // Sudden spike (10x)
    { duration: '30s', target: 500 },  // Stay at spike
    { duration: '10s', target: 50 },   // Return to normal
    { duration: '1m', target: 50 },    // Stay at normal
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],
    http_req_failed: ['rate<0.03'],
    successful_requests: ['rate>0.97'],
    checks: ['rate>0.85'],
  },
  tags: {
    test: 'load',
    type: 'spike',
    environment: __ENV.ENVIRONMENT || 'development',
  },
};

// Track spike phase
let spikePhase = 'ramp-up';
let preSpikeSuccessRate = 0;
let duringSpikeSuccessRate = 0;
let postSpikeSuccessRate = 0;

// Test setup
export function setup() {
  log('Starting spike test - simulating sudden traffic burst', 'info');
  
  const healthUrl = getFullUrl('/api/health');
  const healthRes = http.get(healthUrl);
  
  if (healthRes.status !== 200) {
    throw new Error('System health check failed - aborting spike test');
  }
  
  return { startTime: Date.now() };
}

// Main test function
export default function (data) {
  const sport = config.defaultSport;
  
  // Determine current phase based on VU count
  const currentVUs = __VU;
  if (currentVUs <= 50) {
    spikePhase = 'pre-spike';
  } else if (currentVUs >= 400) {
    spikePhase = 'during-spike';
  } else {
    spikePhase = 'post-spike';
  }
  
  // Target high-traffic endpoints
  const url = getFullUrl(`/api/public/tournaments?sport=${sport}`);
  const res = http.get(url, { tags: { phase: spikePhase, endpoint: 'tournaments' } });
  
  const success = check(res, {
    'spike: request OK': (r) => r.status < 500,
    'spike: response time reasonable': (r) => r.timings.duration < 5000,
    'spike: no timeout': (r) => r.timings.duration < 10000,
  });
  
  successfulRequests.add(success);
  responseTimeTrend.add(res.timings.duration);
  
  if (!success) {
    droppedRequests.add(1);
  }
  
  // Check recovery after spike
  if (spikePhase === 'post-spike' && res.status === 200) {
    recoveredRequests.add(1);
  }
  
  think(config.thinkTime.short);
}

// Teardown
export function teardown(data) {
  const totalDuration = Date.now() - data.startTime;
  log(`Spike test completed in ${totalDuration}ms`, 'info');
}

// Handle test summary
export function handleSummary(data) {
  const metrics = data.metrics;
  const summary = {
    test: 'spike-load',
    timestamp: new Date().toISOString(),
    duration: metrics.iteration_duration?.values?.avg || 0,
    requestsPerSecond: metrics.http_reqs?.values?.rate || 0,
    avgResponseTime: metrics.http_req_duration?.values?.avg || 0,
    p95ResponseTime: metrics.http_req_duration?.values?.['p(95)'] || 0,
    p99ResponseTime: metrics.http_req_duration?.values?.['p(99)'] || 0,
    errorRate: metrics.http_req_failed?.values?.rate || 0,
    successRate: metrics.successful_requests?.values?.rate || 0,
    droppedRequests: metrics.dropped_requests?.values?.count || 0,
    recoveryRate: metrics.recovered_requests?.values?.rate || 0,
    passed: metrics.http_req_failed?.values?.rate < 0.03 &&
            metrics.http_req_duration?.values?.['p(95)'] < 2000,
  };
  
  return {
    stdout: JSON.stringify(summary, null, 2),
    'summary-spike-load.json': JSON.stringify(summary, null, 2),
  };
}
