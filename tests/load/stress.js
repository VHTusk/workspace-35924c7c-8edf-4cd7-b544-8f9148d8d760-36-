/**
 * VALORHIVE Load Testing - Stress Test
 * 
 * Tests system limits and breaking points.
 * - Ramp up to 5000 concurrent users
 * - Find system capacity limits
 * - Higher error rate tolerance
 * 
 * Run with: k6 run tests/load/stress.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';
import { config, getFullUrl, think, log } from '../synthetic/config.js';

// Custom metrics
const successfulRequests = new Rate('successful_requests');
const failedRequests = new Counter('failed_requests');
const responseTimeTrend = new Trend('response_time');
const timeoutErrors = new Counter('timeout_errors');
const systemOverloaded = new Rate('system_overloaded');

// Test configuration - Stress test (5000 users)
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 500 },   // Ramp up to 500 users
    { duration: '5m', target: 1000 },  // Ramp up to 1000 users
    { duration: '5m', target: 2500 },  // Ramp up to 2500 users
    { duration: '5m', target: 5000 },  // Ramp up to 5000 users
    { duration: '10m', target: 5000 }, // Stay at 5000 users
    { duration: '3m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
    successful_requests: ['rate>0.95'],
    checks: ['rate>0.80'],
  },
  tags: {
    test: 'load',
    type: 'stress',
    environment: __ENV.ENVIRONMENT || 'development',
  },
};

// Test setup
export function setup() {
  log('Starting stress test - WARNING: This test pushes system to limits', 'warn');
  
  const healthUrl = getFullUrl('/api/health');
  const healthRes = http.get(healthUrl);
  
  if (healthRes.status !== 200) {
    throw new Error('System health check failed - aborting stress test');
  }
  
  return { startTime: Date.now() };
}

// Main test function
export default function (data) {
  const sport = config.defaultSport;
  
  // Mix of operations under stress
  const rand = Math.random();
  
  if (rand < 0.4) {
    // Tournament list
    const url = getFullUrl(`/api/public/tournaments?sport=${sport}`);
    const res = http.get(url, { tags: { test: 'stress', endpoint: 'tournaments' } });
    
    check(res, {
      'stress: tournaments OK': (r) => r.status < 500,
      'stress: tournaments not timeout': (r) => r.timings.duration < 10000,
    });
    
    successfulRequests.add(res.status < 500);
    responseTimeTrend.add(res.timings.duration);
    
    if (res.timings.duration > 5000) {
      timeoutErrors.add(1);
    }
    if (res.status >= 500) {
      systemOverloaded.add(1);
    }
  } else if (rand < 0.7) {
    // Leaderboard
    const url = getFullUrl(`/api/leaderboard?sport=${sport}`);
    const res = http.get(url, { tags: { test: 'stress', endpoint: 'leaderboard' } });
    
    check(res, {
      'stress: leaderboard OK': (r) => r.status < 500,
    });
    
    successfulRequests.add(res.status < 500);
    responseTimeTrend.add(res.timings.duration);
  } else if (rand < 0.85) {
    // Live matches
    const url = getFullUrl(`/api/matches/live?sport=${sport}`);
    const res = http.get(url, { tags: { test: 'stress', endpoint: 'live' } });
    
    check(res, {
      'stress: live OK': (r) => r.status < 500,
    });
    
    successfulRequests.add(res.status < 500);
    responseTimeTrend.add(res.timings.duration);
  } else {
    // Health check
    const url = getFullUrl('/api/health');
    const res = http.get(url, { tags: { test: 'stress', endpoint: 'health' } });
    
    check(res, {
      'stress: health OK': (r) => r.status === 200,
    });
    
    successfulRequests.add(res.status === 200);
    responseTimeTrend.add(res.timings.duration);
  }
  
  // Very short think time under stress
  think(0.5);
}

// Teardown
export function teardown(data) {
  const totalDuration = Date.now() - data.startTime;
  log(`Stress test completed in ${totalDuration}ms`, 'info');
}

// Handle test summary
export function handleSummary(data) {
  const metrics = data.metrics;
  const summary = {
    test: 'stress-load',
    timestamp: new Date().toISOString(),
    duration: metrics.iteration_duration?.values?.avg || 0,
    requestsPerSecond: metrics.http_reqs?.values?.rate || 0,
    avgResponseTime: metrics.http_req_duration?.values?.avg || 0,
    p95ResponseTime: metrics.http_req_duration?.values?.['p(95)'] || 0,
    p99ResponseTime: metrics.http_req_duration?.values?.['p(99)'] || 0,
    errorRate: metrics.http_req_failed?.values?.rate || 0,
    successRate: metrics.successful_requests?.values?.rate || 0,
    timeoutErrors: metrics.timeout_errors?.values?.count || 0,
    systemOverloadedRate: metrics.system_overloaded?.values?.rate || 0,
    passed: metrics.http_req_failed?.values?.rate < 0.05,
  };
  
  return {
    stdout: JSON.stringify(summary, null, 2),
    'summary-stress-load.json': JSON.stringify(summary, null, 2),
  };
}
