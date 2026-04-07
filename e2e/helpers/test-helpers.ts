/**
 * VALORHIVE E2E Test Helpers
 * 
 * Common utilities for Playwright E2E tests
 */

import { Page, expect } from '@playwright/test';

/**
 * Test user credentials for different roles
 */
export const TEST_USERS = {
  player: {
    email: 'test-player@valorhive.test',
    phone: '9876543210',
    password: 'TestPlayer123!',
  },
  organization: {
    email: 'test-org@valorhive.test',
    phone: '9876543211',
    password: 'TestOrg123!',
  },
  admin: {
    email: 'test-admin@valorhive.test',
    password: 'TestAdmin123!',
  },
};

/**
 * Sport slugs for testing
 */
export const SPORTS = {
  cornhole: 'cornhole',
  darts: 'darts',
} as const;

/**
 * Wait for page to fully load
 * @param page Playwright page object
 * @param waitForSelector Optional selector to wait for
 */
export async function waitForPageLoad(page: Page, waitForSelector?: string): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  
  if (waitForSelector) {
    await page.waitForSelector(waitForSelector, { timeout: 10000 });
  }
}

/**
 * Login as a player
 * @param page Playwright page object
 * @param sport Sport slug (cornhole or darts)
 * @param email Player email
 * @param password Player password
 */
export async function loginAsPlayer(
  page: Page,
  sport: string = SPORTS.cornhole,
  email: string = TEST_USERS.player.email,
  password: string = TEST_USERS.player.password
): Promise<void> {
  // Navigate to login page
  await page.goto(`/${sport}/login`);
  await waitForPageLoad(page);
  
  // Fill in login form
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for redirect to dashboard
  await page.waitForURL(`**/${sport}/dashboard**`, { timeout: 15000 });
}

/**
 * Login as an organization
 * @param page Playwright page object
 * @param sport Sport slug (cornhole or darts)
 * @param email Organization email
 * @param password Organization password
 */
export async function loginAsOrg(
  page: Page,
  sport: string = SPORTS.cornhole,
  email: string = TEST_USERS.organization.email,
  password: string = TEST_USERS.organization.password
): Promise<void> {
  // Navigate to org login page
  await page.goto(`/${sport}/org/login`);
  await waitForPageLoad(page);
  
  // Fill in login form
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for redirect to org dashboard
  await page.waitForURL(`**/${sport}/org/dashboard**`, { timeout: 15000 });
}

/**
 * Login as an admin
 * @param page Playwright page object
 * @param sport Sport slug (cornhole or darts)
 * @param email Admin email
 * @param password Admin password
 */
export async function loginAsAdmin(
  page: Page,
  sport: string = SPORTS.cornhole,
  email: string = TEST_USERS.admin.email,
  password: string = TEST_USERS.admin.password
): Promise<void> {
  // Navigate to admin login page
  await page.goto(`/${sport}/admin/login`);
  await waitForPageLoad(page);
  
  // Fill in login form
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for redirect to admin dashboard
  await page.waitForURL(`**/${sport}/admin**`, { timeout: 15000 });
}

/**
 * Logout current user
 * @param page Playwright page object
 */
export async function logout(page: Page): Promise<void> {
  // Try to find and click logout button
  const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout")');
  
  if (await logoutButton.count() > 0) {
    await logoutButton.first().click();
  } else {
    // Try API logout
    await page.request.post('/api/auth/logout');
  }
  
  // Clear cookies and storage
  await page.context().clearCookies();
}

/**
 * Navigate to a sport page
 * @param page Playwright page object
 * @param sport Sport slug
 */
export async function navigateToSport(page: Page, sport: string): Promise<void> {
  await page.goto(`/${sport}`);
  await waitForPageLoad(page);
}

/**
 * Fill OTP input fields
 * @param page Playwright page object
 * @param otp The OTP code to enter
 */
export async function fillOTP(page: Page, otp: string): Promise<void> {
  const otpInputs = page.locator('input[data-slot], input[maxlength="1"]');
  const count = await otpInputs.count();
  
  for (let i = 0; i < count && i < otp.length; i++) {
    await otpInputs.nth(i).fill(otp[i]);
  }
}

/**
 * Wait for toast notification
 * @param page Playwright page object
 * @param message Optional message to wait for
 */
export async function waitForToast(page: Page, message?: string): Promise<void> {
  const toast = page.locator('[data-sonner-toast], [role="alert"], .toast');
  await toast.waitFor({ timeout: 5000 });
  
  if (message) {
    await expect(toast).toContainText(message);
  }
}

/**
 * Take a screenshot for debugging
 * @param page Playwright page object
 * @param name Screenshot name
 */
export async function takeDebugScreenshot(page: Page, name: string): Promise<void> {
  if (process.env.DEBUG_E2E) {
    await page.screenshot({ path: `./e2e/screenshots/${name}.png`, fullPage: true });
  }
}

/**
 * Check if element is visible
 * @param page Playwright page object
 * @param selector Element selector
 */
export async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    const element = page.locator(selector);
    return await element.isVisible({ timeout: 5000 });
  } catch {
    return false;
  }
}

/**
 * Wait for navigation to complete
 * @param page Playwright page object
 * @param expectedUrl Expected URL pattern
 */
export async function waitForNavigation(page: Page, expectedUrl: string | RegExp): Promise<void> {
  await page.waitForURL(expectedUrl, { timeout: 15000 });
}

/**
 * Mock API response for testing
 * @param page Playwright page object
 * @param urlPattern URL pattern to match
 * @param response Mock response data
 */
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  response: object
): Promise<void> {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Generate a random test email
 * @returns Random email for testing
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  return `test-${timestamp}@valorhive.test`;
}

/**
 * Generate a random test phone number
 * @returns Random phone number for testing
 */
export function generateTestPhone(): string {
  const random = Math.floor(Math.random() * 9000000000) + 1000000000;
  return random.toString();
}

/**
 * Skip test if condition is true
 * @param condition Condition to check
 * @param reason Reason for skipping
 */
export function skipIf(condition: boolean, reason: string): void {
  if (condition) {
    console.log(`Skipping test: ${reason}`);
  }
}
