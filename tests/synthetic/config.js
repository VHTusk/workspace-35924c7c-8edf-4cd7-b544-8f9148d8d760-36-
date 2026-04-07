/**
 * VALORHIVE Synthetic Monitoring Configuration
 * 
 * This file contains shared configuration for all synthetic tests.
 * Environment variables can override defaults.
 */

import { sleep } from 'k6';

// Environment configuration
export const config = {
  // Base URL for the application
  baseUrl: __ENV.BASE_URL || 'http://localhost:3000',
  
  // API version
  apiVersion: __ENV.API_VERSION || 'v1',
  
  // Test user credentials (use environment variables in CI/CD)
  testUsers: {
    player: {
      email: __ENV.TEST_PLAYER_EMAIL || 'test-player@valorhive.test',
      password: __ENV.TEST_PLAYER_PASSWORD || 'TestPassword123!',
      phone: __ENV.TEST_PLAYER_PHONE || '+919999999999',
    },
    director: {
      email: __ENV.TEST_DIRECTOR_EMAIL || 'test-director@valorhive.test',
      password: __ENV.TEST_DIRECTOR_PASSWORD || 'TestDirector123!',
    },
    admin: {
      email: __ENV.TEST_ADMIN_EMAIL || 'test-admin@valorhive.test',
      password: __ENV.TEST_ADMIN_PASSWORD || 'TestAdmin123!',
    },
    org: {
      email: __ENV.TEST_ORG_EMAIL || 'test-org@valorhive.test',
      password: __ENV.TEST_ORG_PASSWORD || 'TestOrg123!',
    },
  },
  
  // Test organization ID
  testOrgId: __ENV.TEST_ORG_ID || 'test-org-123',
  
  // Test tournament ID
  testTournamentId: __ENV.TEST_TOURNAMENT_ID || 'test-tournament-123',
  
  // Default sport for testing
  defaultSport: __ENV.DEFAULT_SPORT || 'cornhole',
  
  // Think times (in seconds) - simulate realistic user behavior
  thinkTime: {
    short: 1,      // Quick navigation
    medium: 3,     // Reading/scanning content
    long: 5,       // Form filling, decision making
    veryLong: 10,  // Complex operations
  },
  
  // Timeout settings (in milliseconds)
  timeouts: {
    request: 30000,     // HTTP request timeout
    pageLoad: 10000,    // Page load timeout
    apiResponse: 5000,  // API response timeout
  },
  
  // Retry settings
  retries: {
    maxAttempts: 3,
    backoffMs: 1000,
  },
};

// Performance thresholds for synthetic tests
export const thresholds = {
  // Response time thresholds (in milliseconds)
  responseTime: {
    p50: 500,    // 50th percentile
    p90: 1000,   // 90th percentile
    p95: 2000,   // 95th percentile
    p99: 5000,   // 99th percentile
    max: 10000,  // Maximum allowed
  },
  
  // Error rate thresholds (percentage)
  errorRate: {
    warning: 1,    // Warning threshold
    critical: 5,   // Critical threshold
  },
  
  // Success rate thresholds (percentage)
  successRate: {
    minimum: 95,   // Minimum acceptable
    target: 99,    // Target success rate
  },
  
  // Availability thresholds (percentage)
  availability: {
    minimum: 99.5,  // Minimum acceptable
    target: 99.9,   // Target availability
  },
};

// Stage configuration for load tests
export const stages = {
  // Baseline test stages (100 users)
  baseline: [
    { duration: '1m', target: 20 },    // Ramp up to 20 users
    { duration: '2m', target: 50 },    // Ramp up to 50 users
    { duration: '3m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '1m', target: 0 },     // Ramp down
  ],
  
  // Peak test stages (1000 users)
  peak: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 500 },   // Ramp up to 500 users
    { duration: '5m', target: 1000 },  // Ramp up to 1000 users
    { duration: '10m', target: 1000 }, // Stay at 1000 users
    { duration: '2m', target: 0 },     // Ramp down
  ],
  
  // Stress test stages (5000 users)
  stress: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 500 },   // Ramp up to 500 users
    { duration: '5m', target: 1000 },  // Ramp up to 1000 users
    { duration: '5m', target: 2500 },  // Ramp up to 2500 users
    { duration: '5m', target: 5000 },  // Ramp up to 5000 users
    { duration: '10m', target: 5000 }, // Stay at 5000 users
    { duration: '3m', target: 0 },     // Ramp down
  ],
  
  // Spike test stages (sudden traffic burst)
  spike: [
    { duration: '30s', target: 50 },   // Normal load
    { duration: '10s', target: 500 },  // Sudden spike
    { duration: '30s', target: 500 },  // Stay at spike
    { duration: '10s', target: 50 },   // Return to normal
    { duration: '1m', target: 50 },    // Stay at normal
    { duration: '30s', target: 0 },    // Ramp down
  ],
};

// Load test thresholds
export const loadThresholds = {
  baseline: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.95'],
  },
  
  peak: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.02'],
    checks: ['rate>0.90'],
  },
  
  stress: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.80'],
  },
  
  spike: {
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],
    http_req_failed: ['rate<0.03'],
    checks: ['rate>0.85'],
  },
};

// Alert configuration
export const alerts = {
  // Webhook URL for alerts (Slack, PagerDuty, etc.)
  webhookUrl: __ENV.ALERT_WEBHOOK_URL || '',
  
  // Email recipients for alerts
  emailRecipients: (__ENV.ALERT_EMAILS || '').split(',').filter(Boolean),
  
  // Alert severity levels
  severity: {
    info: 'info',
    warning: 'warning',
    critical: 'critical',
  },
  
  // Conditions that trigger alerts
  conditions: {
    responseTime: {
      warning: thresholds.responseTime.p95,
      critical: thresholds.responseTime.p99,
    },
    errorRate: {
      warning: thresholds.errorRate.warning,
      critical: thresholds.errorRate.critical,
    },
    availability: {
      warning: 99.0,
      critical: 95.0,
    },
  },
};

// Health check endpoints
export const healthEndpoints = {
  basic: '/api/health',
  ready: '/api/health/ready',
  detailed: '/api/health/detailed',
  v1Health: '/api/v1/health',
  v1Ready: '/api/v1/health/ready',
};

// Critical user journeys for synthetic monitoring
export const criticalJourneys = [
  {
    name: 'auth-flow',
    description: 'User authentication flow (login/logout)',
    priority: 'critical',
    endpoints: ['/api/auth/login', '/api/auth/check', '/api/auth/logout'],
  },
  {
    name: 'tournament-registration',
    description: 'Tournament registration flow',
    priority: 'high',
    endpoints: ['/api/tournaments', '/api/tournaments/[id]/register'],
  },
  {
    name: 'leaderboard',
    description: 'Leaderboard access',
    priority: 'high',
    endpoints: ['/api/leaderboard', '/api/public/leaderboard'],
  },
  {
    name: 'match-scoring',
    description: 'Score submission flow',
    priority: 'critical',
    endpoints: ['/api/matches/[id]/score', '/api/matches/live'],
  },
  {
    name: 'payment-flow',
    description: 'Payment verification',
    priority: 'critical',
    endpoints: ['/api/payments/create-order', '/api/payments/verify'],
  },
];

// Helper function to get full URL
export function getFullUrl(path) {
  return `${config.baseUrl}${path}`;
}

// Helper function to get API URL with version
export function getApiUrl(path) {
  return `${config.baseUrl}/api/${config.apiVersion}${path}`;
}

// Helper function to think/sleep
export function think(seconds = config.thinkTime.medium) {
  sleep(seconds);
}

// Helper function to log with timestamp
export function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
}
