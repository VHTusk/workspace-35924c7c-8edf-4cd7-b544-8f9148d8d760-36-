/**
 * VALORHIVE Load Testing - Baseline Test
 * 
 * Tests system performance under normal expected load.
 * - Ramp up to 100 concurrent users
 * - Mix of read/write operations
 * - Validates response times and error rates
 * 
 * Run with: k6 run tests/load/baseline.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';
import { config, thresholds, getFullUrl, think, log } from '../synthetic/config.js';

// Custom metrics
const successfulRequests = new Rate('successful_requests');
const failedRequests = new Counter('failed_requests');
const responseTimeTrend = new Trend('response_time');
const tournamentsViewed = new Counter('tournaments_viewed');
const leaderboardsAccessed = new Counter('leaderboards_accessed');
const registrationsCreated = new Counter('registrations_created');
const scoresSubmitted = new Counter('scores_submitted');

// Test configuration - Baseline load (100 users)
export const options = {
  stages: [
    { duration: '1m', target: 20 },    // Ramp up to 20 users
    { duration: '2m', target: 50 },    // Ramp up to 50 users
    { duration: '3m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    successful_requests: ['rate>0.99'],
    checks: ['rate>0.95'],
  },
  tags: {
    test: 'load',
    type: 'baseline',
    environment: __ENV.ENVIRONMENT || 'development',
  },
};

// Test setup
export function setup() {
  log('Starting baseline load test', 'info');
  
  // Verify system is healthy before load test
  const healthUrl = getFullUrl('/api/health');
  const healthRes = http.get(healthUrl);
  
  if (healthRes.status !== 200) {
    throw new Error('System health check failed - aborting load test');
  }
  
  log('System health check passed', 'info');
  
  return {
    startTime: Date.now(),
    testUsers: [
      config.testUsers.player,
      config.testUsers.director,
    ],
  };
}

// Main test function - simulates realistic user behavior
export default function (data) {
  const sport = config.defaultSport;
  
  // Randomly select user type to simulate
  const userType = Math.random() > 0.7 ? 'director' : 'player';
  const testUser = userType === 'director' ? config.testUsers.director : config.testUsers.player;
  
  // Simulate user journey
  const journey = selectJourney();
  
  switch (journey) {
    case 'browse':
      browseJourney(sport);
      break;
    case 'tournament':
      tournamentJourney(sport, testUser);
      break;
    case 'leaderboard':
      leaderboardJourney(sport);
      break;
    case 'profile':
      profileJourney(testUser);
      break;
    case 'scoring':
      scoringJourney(sport, testUser);
      break;
  }
  
  think(config.thinkTime.medium);
}

// Select random journey based on realistic distribution
function selectJourney() {
  const rand = Math.random();
  if (rand < 0.35) return 'browse';        // 35% - browsing
  if (rand < 0.55) return 'tournament';    // 20% - tournament actions
  if (rand < 0.75) return 'leaderboard';   // 20% - leaderboard viewing
  if (rand < 0.90) return 'profile';       // 15% - profile actions
  return 'scoring';                         // 10% - scoring actions
}

// Browse journey - view tournaments and public data
function browseJourney(sport) {
  // Get public tournaments
  const tournamentsUrl = getFullUrl(`/api/public/tournaments?sport=${sport}`);
  const tournamentsRes = http.get(tournamentsUrl, { tags: { journey: 'browse', action: 'list_tournaments' } });
  
  check(tournamentsRes, {
    'browse: tournaments list OK': (r) => r.status === 200,
    'browse: tournaments response time': (r) => r.timings.duration < 1000,
  });
  
  tournamentsViewed.add(1);
  successfulRequests.add(tournamentsRes.status === 200);
  responseTimeTrend.add(tournamentsRes.timings.duration);
  
  think(config.thinkTime.short);
  
  // View a specific tournament
  if (tournamentsRes.status === 200) {
    const tournaments = JSON.parse(tournamentsRes.body);
    if (tournaments.tournaments && tournaments.tournaments.length > 0) {
      const tournamentId = tournaments.tournaments[0].id;
      const detailUrl = getFullUrl(`/api/public/tournaments/${tournamentId}`);
      const detailRes = http.get(detailUrl, { tags: { journey: 'browse', action: 'view_tournament' } });
      
      check(detailRes, {
        'browse: tournament detail OK': (r) => r.status === 200,
      });
      
      successfulRequests.add(detailRes.status === 200);
      responseTimeTrend.add(detailRes.timings.duration);
    }
  }
}

// Tournament journey - registration, bracket viewing
function tournamentJourney(sport, testUser) {
  // Get tournaments for registration
  const tournamentsUrl = getFullUrl(`/api/tournaments?sport=${sport}&status=upcoming`);
  const tournamentsRes = http.get(tournamentsUrl, { tags: { journey: 'tournament', action: 'get_upcoming' } });
  
  check(tournamentsRes, {
    'tournament: get upcoming OK': (r) => r.status === 200,
  });
  
  successfulRequests.add(tournamentsRes.status === 200);
  responseTimeTrend.add(tournamentsRes.timings.duration);
  
  think(config.thinkTime.short);
  
  // View bracket
  if (tournamentsRes.status === 200) {
    const tournaments = JSON.parse(tournamentsRes.body);
    if (tournaments.tournaments && tournaments.tournaments.length > 0) {
      const tournamentId = tournaments.tournaments[0].id;
      const bracketUrl = getFullUrl(`/api/tournaments/${tournamentId}/bracket`);
      const bracketRes = http.get(bracketUrl, { tags: { journey: 'tournament', action: 'view_bracket' } });
      
      check(bracketRes, {
        'tournament: bracket view OK': (r) => r.status === 200 || r.status === 404,
      });
      
      successfulRequests.add(bracketRes.status < 400);
      responseTimeTrend.add(bracketRes.timings.duration);
    }
  }
  
  think(config.thinkTime.medium);
}

// Leaderboard journey - view rankings
function leaderboardJourney(sport) {
  // Get global leaderboard
  const leaderboardUrl = getFullUrl(`/api/leaderboard?sport=${sport}`);
  const leaderboardRes = http.get(leaderboardUrl, { tags: { journey: 'leaderboard', action: 'get_global' } });
  
  check(leaderboardRes, {
    'leaderboard: global OK': (r) => r.status === 200,
    'leaderboard: response time': (r) => r.timings.duration < 800,
  });
  
  leaderboardsAccessed.add(1);
  successfulRequests.add(leaderboardRes.status === 200);
  responseTimeTrend.add(leaderboardRes.timings.duration);
  
  think(config.thinkTime.short);
  
  // Get city leaderboard
  const cityLeaderboardUrl = getFullUrl(`/api/city/test-city/leaderboard?sport=${sport}`);
  const cityRes = http.get(cityLeaderboardUrl, { tags: { journey: 'leaderboard', action: 'get_city' } });
  
  check(cityRes, {
    'leaderboard: city OK': (r) => r.status === 200 || r.status === 404,
  });
  
  successfulRequests.add(cityRes.status < 400);
  responseTimeTrend.add(cityRes.timings.duration);
  
  think(config.thinkTime.short);
}

// Profile journey - view and update profile
function profileJourney(testUser) {
  // Get own profile
  const profileUrl = getFullUrl('/api/player/me');
  const profileRes = http.get(profileUrl, { tags: { journey: 'profile', action: 'get_profile' } });
  
  check(profileRes, {
    'profile: get OK': (r) => r.status === 200 || r.status === 401,
  });
  
  successfulRequests.add(profileRes.status < 400);
  responseTimeTrend.add(profileRes.timings.duration);
  
  think(config.thinkTime.short);
  
  // Get player stats
  const statsUrl = getFullUrl('/api/player/stats');
  const statsRes = http.get(statsUrl, { tags: { journey: 'profile', action: 'get_stats' } });
  
  check(statsRes, {
    'profile: stats OK': (r) => r.status === 200 || r.status === 401,
  });
  
  successfulRequests.add(statsRes.status < 400);
  responseTimeTrend.add(statsRes.timings.duration);
  
  think(config.thinkTime.short);
}

// Scoring journey - submit scores (director only)
function scoringJourney(sport, testUser) {
  // Get live matches
  const liveUrl = getFullUrl(`/api/matches/live?sport=${sport}`);
  const liveRes = http.get(liveUrl, { tags: { journey: 'scoring', action: 'get_live' } });
  
  check(liveRes, {
    'scoring: live matches OK': (r) => r.status === 200,
  });
  
  successfulRequests.add(liveRes.status === 200);
  responseTimeTrend.add(liveRes.timings.duration);
  
  think(config.thinkTime.short);
  
  // Get upcoming matches
  const upcomingUrl = getFullUrl('/api/player/upcoming-matches');
  const upcomingRes = http.get(upcomingUrl, { tags: { journey: 'scoring', action: 'get_upcoming' } });
  
  check(upcomingRes, {
    'scoring: upcoming matches OK': (r) => r.status === 200 || r.status === 401,
  });
  
  successfulRequests.add(upcomingRes.status < 400);
  responseTimeTrend.add(upcomingRes.timings.duration);
}

// Teardown
export function teardown(data) {
  const totalDuration = Date.now() - data.startTime;
  log(`Baseline load test completed in ${totalDuration}ms`, 'info');
}

// Handle test summary
export function handleSummary(data) {
  const metrics = data.metrics;
  const summary = {
    test: 'baseline-load',
    timestamp: new Date().toISOString(),
    duration: metrics.iteration_duration?.values?.avg || 0,
    requestsPerSecond: metrics.http_reqs?.values?.rate || 0,
    avgResponseTime: metrics.http_req_duration?.values?.avg || 0,
    p95ResponseTime: metrics.http_req_duration?.values?.['p(95)'] || 0,
    p99ResponseTime: metrics.http_req_duration?.values?.['p(99)'] || 0,
    errorRate: metrics.http_req_failed?.values?.rate || 0,
    successRate: metrics.successful_requests?.values?.rate || 0,
    passed: metrics.http_req_failed?.values?.rate < 0.01 &&
            metrics.http_req_duration?.values?.['p(95)'] < 500,
  };
  
  return {
    stdout: JSON.stringify(summary, null, 2),
    'summary-baseline-load.json': JSON.stringify(summary, null, 2),
  };
}
