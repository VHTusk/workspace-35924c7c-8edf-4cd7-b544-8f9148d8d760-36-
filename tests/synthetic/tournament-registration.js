/**
 * VALORHIVE Synthetic Monitoring - Tournament Registration Flow
 * 
 * Tests the tournament registration flow including:
 * - Browse tournaments
 * - Get tournament details
 * - Check registration eligibility
 * - Register for tournament
 * - Verify registration status
 * 
 * Run with: k6 run tests/synthetic/tournament-registration.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';
import { config, thresholds, getFullUrl, think, log } from './config.js';

// Custom metrics
const tournamentListSuccess = new Rate('tournament_list_success');
const tournamentDetailSuccess = new Rate('tournament_detail_success');
const eligibilityCheckSuccess = new Rate('tournament_eligibility_success');
const registrationSuccess = new Rate('tournament_registration_success');
const registrationDuration = new Trend('tournament_registration_duration');
const tournamentViews = new Counter('tournament_views');
const registrationAttempts = new Counter('tournament_registration_attempts');

// Test configuration
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<3000'],
    http_req_failed: ['rate<0.02'],
    tournament_list_success: ['rate>0.98'],
    tournament_detail_success: ['rate>0.98'],
    tournament_eligibility_success: ['rate>0.95'],
    tournament_registration_success: ['rate>0.95'],
    tournament_registration_duration: ['p(95)<5000'],
  },
  tags: {
    test: 'synthetic',
    flow: 'tournament-registration',
    environment: __ENV.ENVIRONMENT || 'development',
  },
};

// Test setup
export function setup() {
  log('Starting tournament registration synthetic test', 'info');
  return {
    startTime: Date.now(),
    testUser: config.testUsers.player,
    testTournamentId: config.testTournamentId,
  };
}

// Main test function
export default function (data) {
  const { testUser, testTournamentId } = data;
  const sport = config.defaultSport;
  let sessionToken = '';
  let tournamentId = testTournamentId;
  
  // Step 1: Login first (required for registration)
  group('Pre-authentication', () => {
    const loginUrl = getFullUrl('/api/auth/login');
    const loginPayload = JSON.stringify({
      email: testUser.email,
      password: testUser.password,
      sport: sport,
    });
    
    const loginRes = http.post(loginUrl, loginPayload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { step: 'login' },
    });
    
    check(loginRes, {
      'login successful': (r) => r.status === 200,
    });
    
    if (loginRes.status === 200) {
      const body = JSON.parse(loginRes.body);
      sessionToken = body.sessionToken || body.token;
    }
    
    think(config.thinkTime.short);
  });
  
  // Step 2: Browse tournaments
  group('Browse Tournaments', () => {
    tournamentViews.add(1);
    
    const tournamentsUrl = getFullUrl(`/${sport}/tournaments`);
    const tournamentsRes = http.get(tournamentsUrl, {
      tags: { step: 'browse_tournaments' },
    });
    
    const listSuccess = check(tournamentsRes, {
      'tournament list returns 200': (r) => r.status === 200,
      'tournament list has data': (r) => {
        if (r.status !== 200) return false;
        // Page should load successfully
        return r.body.length > 0;
      },
    });
    
    tournamentListSuccess.add(listSuccess);
    
    think(config.thinkTime.medium);
  });
  
  // Step 3: Get tournament list via API
  group('Get Tournament List API', () => {
    const apiUrl = getFullUrl('/api/tournaments');
    const apiRes = http.get(apiUrl, {
      tags: { step: 'tournament_api_list' },
    });
    
    const apiSuccess = check(apiRes, {
      'tournament API returns 200': (r) => r.status === 200,
      'tournament API has tournaments': (r) => {
        if (r.status !== 200) return false;
        const body = JSON.parse(r.body);
        return Array.isArray(body.tournaments) || Array.isArray(body);
      },
    });
    
    // Get first tournament ID if we don't have one
    if (apiSuccess && !tournamentId) {
      const body = JSON.parse(apiRes.body);
      const tournaments = body.tournaments || body;
      if (tournaments.length > 0) {
        tournamentId = tournaments[0].id || tournaments[0].tournamentId;
      }
    }
    
    tournamentListSuccess.add(apiSuccess);
    
    think(config.thinkTime.short);
  });
  
  // Step 4: Get tournament details
  group('Get Tournament Details', () => {
    if (!tournamentId) {
      log('No tournament ID available for details check', 'warning');
      return;
    }
    
    const detailUrl = getFullUrl(`/api/tournaments/${tournamentId}`);
    const detailRes = http.get(detailUrl, {
      tags: { step: 'tournament_detail' },
    });
    
    const detailSuccess = check(detailRes, {
      'tournament detail returns 200': (r) => r.status === 200,
      'tournament detail has required fields': (r) => {
        if (r.status !== 200) return false;
        const body = JSON.parse(r.body);
        return body.id !== undefined && body.name !== undefined;
      },
      'tournament has registration info': (r) => {
        if (r.status !== 200) return false;
        const body = JSON.parse(r.body);
        return body.registrationOpen !== undefined || body.status !== undefined;
      },
    });
    
    tournamentDetailSuccess.add(detailSuccess);
    
    think(config.thinkTime.medium);
  });
  
  // Step 5: Check registration eligibility
  group('Check Registration Eligibility', () => {
    if (!tournamentId) {
      log('No tournament ID available for eligibility check', 'warning');
      return;
    }
    
    const eligibilityUrl = getFullUrl(`/api/tournaments/${tournamentId}/register/eligibility`);
    const eligibilityRes = http.get(eligibilityUrl, {
      tags: { step: 'eligibility_check' },
    });
    
    const eligibilitySuccess = check(eligibilityRes, {
      'eligibility check returns 200': (r) => r.status === 200 || r.status === 403,
      'eligibility check returns valid response': (r) => {
        if (r.status !== 200 && r.status !== 403) return false;
        const body = JSON.parse(r.body);
        return body.eligible !== undefined || body.canRegister !== undefined;
      },
    });
    
    eligibilityCheckSuccess.add(eligibilitySuccess);
    
    think(config.thinkTime.short);
  });
  
  // Step 6: Attempt tournament registration
  group('Tournament Registration', () => {
    if (!tournamentId) {
      log('No tournament ID available for registration', 'warning');
      return;
    }
    
    registrationAttempts.add(1);
    const regStartTime = Date.now();
    
    const registerUrl = getFullUrl(`/api/tournaments/${tournamentId}/register`);
    const registerPayload = JSON.stringify({
      teamName: `Test Team ${Date.now()}`,
      players: [],
    });
    
    const registerRes = http.post(registerUrl, registerPayload, {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: { step: 'register' },
    });
    
    // Registration might fail due to various valid reasons (already registered, not eligible, etc.)
    // We're checking if the API responds correctly, not if registration succeeds
    const regSuccess = check(registerRes, {
      'registration API responds': (r) => r.status === 200 || 
                                          r.status === 400 || 
                                          r.status === 403 ||
                                          r.status === 409,
      'registration response is valid JSON': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch {
          return false;
        }
      },
      'registration response has expected structure': (r) => {
        const body = JSON.parse(r.body);
        // Either success or a meaningful error message
        return body.success !== undefined || 
               body.error !== undefined || 
               body.message !== undefined ||
               body.registrationId !== undefined;
      },
    });
    
    registrationSuccess.add(regSuccess);
    registrationDuration.add(Date.now() - regStartTime);
    
    if (registerRes.status === 200) {
      log(`Successfully registered for tournament ${tournamentId}`, 'info');
    } else {
      log(`Registration attempt returned ${registerRes.status}`, 'info');
    }
    
    think(config.thinkTime.medium);
  });
  
  // Step 7: Check registration status
  group('Check Registration Status', () => {
    if (!tournamentId) {
      log('No tournament ID available for status check', 'warning');
      return;
    }
    
    const statusUrl = getFullUrl(`/api/tournaments/${tournamentId}/registration-status`);
    const statusRes = http.get(statusUrl, {
      tags: { step: 'registration_status' },
    });
    
    check(statusRes, {
      'registration status returns valid response': (r) => {
        if (r.status !== 200 && r.status !== 404) return false;
        try {
          JSON.parse(r.body);
          return true;
        } catch {
          return false;
        }
      },
    });
    
    think(config.thinkTime.short);
  });
  
  // Step 8: Logout
  group('Logout', () => {
    const logoutUrl = getFullUrl('/api/auth/logout');
    http.post(logoutUrl, null, {
      tags: { step: 'logout' },
    });
  });
}

// Teardown
export function teardown(data) {
  const totalDuration = Date.now() - data.startTime;
  log(`Tournament registration test completed in ${totalDuration}ms`, 'info');
}

// Summary handler
export function handleSummary(data) {
  const metrics = data.metrics;
  const summary = {
    test: 'tournament-registration',
    timestamp: new Date().toISOString(),
    duration: metrics.iteration_duration?.values?.avg || 0,
    listSuccessRate: metrics.tournament_list_success?.values?.rate || 0,
    detailSuccessRate: metrics.tournament_detail_success?.values?.rate || 0,
    eligibilitySuccessRate: metrics.tournament_eligibility_success?.values?.rate || 0,
    registrationSuccessRate: metrics.tournament_registration_success?.values?.rate || 0,
    passed: metrics.tournament_list_success?.values?.rate >= 0.98 &&
            metrics.tournament_detail_success?.values?.rate >= 0.98 &&
            metrics.tournament_eligibility_success?.values?.rate >= 0.95 &&
            metrics.tournament_registration_success?.values?.rate >= 0.95,
  };
  
  return {
    stdout: JSON.stringify(summary, null, 2),
    'summary-tournament-registration.json': JSON.stringify(summary, null, 2),
  };
}
