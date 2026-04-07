/**
 * VALORHIVE Load Testing - Peak Test
 * 
 * Tests system performance under peak expected load.
 * - Ramp up to 1000 concurrent users
 * - Simulates tournament day traffic
 * - Higher thresholds for response times
 * 
 * Run with: k6 run tests/load/peak.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';
import { config, thresholds, getFullUrl, think, log } from '../synthetic/config.js';

// Custom metrics
const successfulRequests = new Rate('successful_requests');
const failedRequests = new Counter('failed_requests');
const responseTimeTrend = new Trend('response_time');
const peakConcurrency = new Counter('peak_concurrent_users');

// Test configuration - Peak load (1000 users)
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 500 },   // Ramp up to 500 users
    { duration: '5m', target: 1000 },  // Ramp up to 1000 users
    { duration: '10m', target: 1000 }, // Stay at 1000 users
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.02'],
    successful_requests: ['rate>0.98'],
    checks: ['rate>0.90'],
  },
  tags: {
    test: 'load',
    type: 'peak',
    environment: __ENV.ENVIRONMENT || 'development',
  },
};

// Test setup
export function setup() {
  log('Starting peak load test', 'info');
  
  // Verify system is healthy before load test
  const healthUrl = getFullUrl('/api/health');
  const healthRes = http.get(healthUrl);
  
  if (healthRes.status !== 200) {
    throw new Error('System health check failed - aborting peak test');
  }
  
  log('System health check passed', 'info');
  
  return {
    startTime: Date.now(),
  };
}

// Main test function - tournament day simulation
export default function (data) {
  const sport = config.defaultSport;
  
  // Simulate tournament day behavior
  // More read-heavy than normal, but also more registrations
  const journey = selectPeakJourney();
  
  switch (journey) {
    case 'tournament-view':
      tournamentViewJourney(sport);
      break;
    case 'leaderboard-check':
      leaderboardCheckJourney(sport);
      break;
    case 'quick-browse':
      quickBrowseJourney(sport);
      break;
    case 'live-scores':
      liveScoresJourney(sport);
      break;
  }
  
  // Shorter think time during peak
  think(config.thinkTime.short);
}

// Select journey for peak load (more read-heavy)
function selectPeakJourney() {
  const rand = Math.random();
  if (rand < 0.40) return 'tournament-view';   // 40% - viewing tournaments
  if (rand < 0.65) return 'leaderboard-check'; // 25% - checking leaderboards
  if (rand < 0.85) return 'quick-browse';      // 20% - quick browsing
  return 'live-scores';                         // 15% - checking live scores
}

// Tournament view journey
function tournamentViewJourney(sport) {
  // Get tournament list
  const url = getFullUrl(`/api/public/tournaments?sport=${sport}&status=live,upcoming`);
  const res = http.get(url, { tags: { journey: 'peak-tournament', action: 'list' } });
  
  check(res, {
    'peak: tournament list OK': (r) => r.status === 200,
    'peak: response time < 1s': (r) => r.timings.duration < 1000,
  });
  
  successfulRequests.add(res.status === 200);
  responseTimeTrend.add(res.timings.duration);
  
  think(config.thinkTime.short);
  
  // View bracket if tournament found
  if (res.status === 200) {
    const data = JSON.parse(res.body);
    if (data.tournaments && data.tournaments.length > 0) {
      const tournamentId = data.tournaments[0].id;
      const bracketUrl = getFullUrl(`/api/tournaments/${tournamentId}/bracket`);
      const bracketRes = http.get(bracketUrl, { tags: { journey: 'peak-tournament', action: 'bracket' } });
      
      check(bracketRes, {
        'peak: bracket OK': (r) => r.status === 200 || r.status === 404,
      });
      
      successfulRequests.add(bracketRes.status < 400);
      responseTimeTrend.add(bracketRes.timings.duration);
    }
  }
}

// Leaderboard check journey
function leaderboardCheckJourney(sport) {
  const url = getFullUrl(`/api/leaderboard?sport=${sport}`);
  const res = http.get(url, { tags: { journey: 'peak-leaderboard', action: 'check' } });
  
  check(res, {
    'peak: leaderboard OK': (r) => r.status === 200,
    'peak: leaderboard response < 1s': (r) => r.timings.duration < 1000,
  });
  
  successfulRequests.add(res.status === 200);
  responseTimeTrend.add(res.timings.duration);
}

// Quick browse journey
function quickBrowseJourney(sport) {
  const url = getFullUrl(`/api/public/tournaments?sport=${sport}&limit=10`);
  const res = http.get(url, { tags: { journey: 'peak-browse', action: 'quick' } });
  
  check(res, {
    'peak: quick browse OK': (r) => r.status === 200,
  });
  
  successfulRequests.add(res.status === 200);
  responseTimeTrend.add(res.timings.duration);
}

// Live scores journey
function liveScoresJourney(sport) {
  const url = getFullUrl(`/api/matches/live?sport=${sport}`);
  const res = http.get(url, { tags: { journey: 'peak-live', action: 'scores' } });
  
  check(res, {
    'peak: live scores OK': (r) => r.status === 200,
    'peak: live scores < 1.5s': (r) => r.timings.duration < 1500,
  });
  
  successfulRequests.add(res.status === 200);
  responseTimeTrend.add(res.timings.duration);
}

// Teardown
export function teardown(data) {
  const totalDuration = Date.now() - data.startTime;
  log(`Peak load test completed in ${totalDuration}ms`, 'info');
}

// Handle test summary
export function handleSummary(data) {
  const metrics = data.metrics;
  const summary = {
    test: 'peak-load',
    timestamp: new Date().toISOString(),
    duration: metrics.iteration_duration?.values?.avg || 0,
    requestsPerSecond: metrics.http_reqs?.values?.rate || 0,
    avgResponseTime: metrics.http_req_duration?.values?.avg || 0,
    p95ResponseTime: metrics.http_req_duration?.values?.['p(95)'] || 0,
    p99ResponseTime: metrics.http_req_duration?.values?.['p(99)'] || 0,
    errorRate: metrics.http_req_failed?.values?.rate || 0,
    successRate: metrics.successful_requests?.values?.rate || 0,
    passed: metrics.http_req_failed?.values?.rate < 0.02 &&
            metrics.http_req_duration?.values?.['p(95)'] < 1000,
  };
  
  return {
    stdout: JSON.stringify(summary, null, 2),
    'summary-peak-load.json': JSON.stringify(summary, null, 2),
  };
}
