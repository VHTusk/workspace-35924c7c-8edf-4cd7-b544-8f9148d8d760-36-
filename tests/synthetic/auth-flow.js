/**
 * VALORHIVE Synthetic Monitoring - Authentication Flow
 * 
 * Tests the complete authentication flow including:
 * - Login with email/password
 * - Session verification
 * - Logout
 * 
 * Run with: k6 run tests/synthetic/auth-flow.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';
import { config, thresholds, getFullUrl, think, log } from './config.js';

// Custom metrics
const loginSuccessRate = new Rate('auth_login_success');
const logoutSuccessRate = new Rate('auth_logout_success');
const sessionCheckRate = new Rate('auth_session_check_success');
const authFlowDuration = new Trend('auth_flow_duration');
const loginAttempts = new Counter('auth_login_attempts');
const failedLogins = new Counter('auth_failed_logins');

// Test configuration
export const options = {
  vus: 1,  // Single user for synthetic monitoring
  iterations: 1,  // Run once per execution
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<3000'],
    http_req_failed: ['rate<0.01'],
    auth_login_success: ['rate>0.99'],
    auth_logout_success: ['rate>0.99'],
    auth_session_check_success: ['rate>0.99'],
    auth_flow_duration: ['p(95)<5000'],
  },
  tags: {
    test: 'synthetic',
    flow: 'auth',
    environment: __ENV.ENVIRONMENT || 'development',
  },
};

// Test setup
export function setup() {
  log('Starting authentication flow synthetic test', 'info');
  return {
    startTime: Date.now(),
    testUser: config.testUsers.player,
  };
}

// Main test function
export default function (data) {
  const { testUser } = data;
  const sport = config.defaultSport;
  
  log('Starting auth flow test iteration', 'info');
  
  // Step 1: Check initial auth status (should be unauthenticated)
  group('Initial Auth Check', () => {
    const checkUrl = getFullUrl('/api/auth/check');
    const checkRes = http.get(checkUrl, {
      tags: { step: 'initial_check' },
    });
    
    check(checkRes, {
      'initial check returns 200': (r) => r.status === 200,
      'initial check shows unauthenticated': (r) => {
        const body = JSON.parse(r.body);
        return body.authenticated === false;
      },
    });
    
    think(config.thinkTime.short);
  });
  
  // Step 2: Login with email/password
  group('Login', () => {
    loginAttempts.add(1);
    const loginStartTime = Date.now();
    
    const loginUrl = getFullUrl('/api/auth/login');
    const loginPayload = JSON.stringify({
      email: testUser.email,
      password: testUser.password,
      sport: sport,
    });
    
    const loginParams = {
      headers: {
        'Content-Type': 'application/json',
      },
      tags: { step: 'login' },
    };
    
    const loginRes = http.post(loginUrl, loginPayload, loginParams);
    
    const loginSuccess = check(loginRes, {
      'login returns 200': (r) => r.status === 200,
      'login returns session token': (r) => {
        if (r.status !== 200) return false;
        const body = JSON.parse(r.body);
        return body.sessionToken !== undefined || body.user !== undefined;
      },
      'login response has user data': (r) => {
        if (r.status !== 200) return false;
        const body = JSON.parse(r.body);
        return body.user !== undefined && body.user.id !== undefined;
      },
      'login response time < 2s': (r) => r.timings.duration < 2000,
    });
    
    loginSuccessRate.add(loginSuccess);
    
    if (!loginSuccess) {
      failedLogins.add(1);
      log(`Login failed for user ${testUser.email}: ${loginRes.status}`, 'error');
    } else {
      log(`Login successful for user ${testUser.email}`, 'info');
    }
    
    think(config.thinkTime.medium);
  });
  
  // Step 3: Verify session after login
  group('Session Verification', () => {
    const checkUrl = getFullUrl('/api/auth/check');
    const checkRes = http.get(checkUrl, {
      tags: { step: 'session_verification' },
    });
    
    const sessionValid = check(checkRes, {
      'session check returns 200': (r) => r.status === 200,
      'session is authenticated': (r) => {
        const body = JSON.parse(r.body);
        return body.authenticated === true;
      },
      'session has user data': (r) => {
        const body = JSON.parse(r.body);
        return body.user !== undefined;
      },
    });
    
    sessionCheckRate.add(sessionValid);
    
    if (!sessionValid) {
      log('Session verification failed after login', 'error');
    }
    
    think(config.thinkTime.short);
  });
  
  // Step 4: Access protected resource
  group('Protected Resource Access', () => {
    const profileUrl = getFullUrl('/api/player/me');
    const profileRes = http.get(profileUrl, {
      tags: { step: 'protected_resource' },
    });
    
    check(profileRes, {
      'protected resource returns 200': (r) => r.status === 200,
      'protected resource has data': (r) => {
        if (r.status !== 200) return false;
        const body = JSON.parse(r.body);
        return body.user !== undefined || body.id !== undefined;
      },
    });
    
    think(config.thinkTime.short);
  });
  
  // Step 5: Logout
  group('Logout', () => {
    const logoutUrl = getFullUrl('/api/auth/logout');
    const logoutRes = http.post(logoutUrl, null, {
      tags: { step: 'logout' },
    });
    
    const logoutSuccess = check(logoutRes, {
      'logout returns 200': (r) => r.status === 200,
      'logout clears session': (r) => {
        if (r.status !== 200) return false;
        const body = JSON.parse(r.body);
        return body.success === true || body.message !== undefined;
      },
    });
    
    logoutSuccessRate.add(logoutSuccess);
    
    if (logoutSuccess) {
      log('Logout successful', 'info');
    } else {
      log('Logout failed', 'error');
    }
    
    think(config.thinkTime.short);
  });
  
  // Step 6: Verify session is cleared
  group('Post-Logout Verification', () => {
    const checkUrl = getFullUrl('/api/auth/check');
    const checkRes = http.get(checkUrl, {
      tags: { step: 'post_logout_check' },
    });
    
    check(checkRes, {
      'post-logout shows unauthenticated': (r) => {
        const body = JSON.parse(r.body);
        return body.authenticated === false;
      },
    });
  });
  
  // Record total flow duration
  authFlowDuration.add(Date.now() - data.startTime);
}

// Teardown
export function teardown(data) {
  const totalDuration = Date.now() - data.startTime;
  log(`Auth flow test completed in ${totalDuration}ms`, 'info');
}

// Handle test errors
export function handleSummary(data) {
  const metrics = data.metrics;
  const summary = {
    test: 'auth-flow',
    timestamp: new Date().toISOString(),
    duration: metrics.iteration_duration?.values?.avg || 0,
    loginSuccessRate: metrics.auth_login_success?.values?.rate || 0,
    logoutSuccessRate: metrics.auth_logout_success?.values?.rate || 0,
    sessionCheckRate: metrics.auth_session_check_success?.values?.rate || 0,
    passed: metrics.auth_login_success?.values?.rate >= 0.99 &&
            metrics.auth_logout_success?.values?.rate >= 0.99 &&
            metrics.auth_session_check_success?.values?.rate >= 0.99,
  };
  
  return {
    stdout: JSON.stringify(summary, null, 2),
    'summary-auth-flow.json': JSON.stringify(summary, null, 2),
  };
}
