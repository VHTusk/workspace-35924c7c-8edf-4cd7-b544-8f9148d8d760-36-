/**
 * VALORHIVE Playwright E2E Test Configuration
 * 
 * Tests cover 10 core flows:
 * 1. Login Flow (auth/login.spec.ts)
 * 2. Register Flow (auth/register.spec.ts)
 * 3. Browse Tournaments (tournaments/browse.spec.ts)
 * 4. Tournament Detail (tournaments/detail.spec.ts)
 * 5. Tournament Registration (tournaments/register.spec.ts)
 * 6. Player Dashboard (player/dashboard.spec.ts)
 * 7. Leaderboard (leaderboard.spec.ts)
 * 8. Organization Login (org/login.spec.ts)
 * 9. Organization Dashboard (org/dashboard.spec.ts)
 * 10. Admin Login (admin/login.spec.ts)
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './e2e',
  
  // Run tests in parallel
  fullyParallel: true,
  
  // Fail build on CI if test.only is left in source
  forbidOnly: !!process.env.CI,
  
  // Retry failed tests on CI
  retries: process.env.CI ? 2 : 0,
  
  // Parallel workers (limited on CI)
  workers: process.env.CI ? 1 : undefined,
  
  // Global test timeout
  timeout: 30000,
  
  // Expect timeout for assertions
  expect: {
    timeout: 10000,
  },
  
  // Reporter configuration
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-results.json' }],
    ['list'],
  ],
  
  // Shared settings for all tests
  use: {
    // Base URL
    baseURL: 'http://localhost:3000',
    
    // Collect trace on failure
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',
    
    // Browser context options
    contextOptions: {
      // Ignore HTTPS errors (useful for local testing)
      ignoreHTTPSErrors: true,
    },
    
    // Action timeout
    actionTimeout: 15000,
    
    // Navigation timeout
    navigationTimeout: 30000,
  },
  
  // Configure projects for different browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile viewport tests
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  
  // Run local dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
