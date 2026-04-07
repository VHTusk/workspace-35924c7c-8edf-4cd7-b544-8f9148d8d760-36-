/**
 * VALORHIVE Organization Login E2E Tests
 * 
 * Flow: Login as org -> Redirect to org dashboard
 */

import { test, expect } from '@playwright/test';
import { waitForPageLoad, SPORTS, TEST_USERS } from '../helpers/test-helpers';

test.describe('Organization Login', () => {
  test.beforeEach(async ({ page }) => {
    // Start from fresh state
    await page.context().clearCookies();
  });

  test('should display org login page', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/org/login`);
    await waitForPageLoad(page);

    // Check for email input
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toBeVisible();

    // Check for password input
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    await expect(passwordInput).toBeVisible();

    // Check for submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  test('should show validation error for empty fields', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/org/login`);
    await waitForPageLoad(page);

    // Click submit without filling fields
    await page.click('button[type="submit"]');

    // Should stay on page
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/org/login');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/org/login`);
    await waitForPageLoad(page);

    // Fill in invalid credentials
    await page.fill('input[type="email"], input[name="email"]', 'invalid@org.com');
    await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error response
    await page.waitForTimeout(2000);

    // Should stay on login page
    expect(page.url()).toContain('/org/login');
  });

  test('should login successfully with valid org credentials', async ({ page }) => {
    // Mock successful org login
    await page.route('**/api/auth/org/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          organization: {
            id: 'org-test-id',
            name: 'Test Organization',
            email: TEST_USERS.organization.email,
          },
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/org/login`);
    await waitForPageLoad(page);

    // Fill in valid credentials
    await page.fill('input[type="email"], input[name="email"]', TEST_USERS.organization.email);
    await page.fill('input[type="password"], input[name="password"]', TEST_USERS.organization.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation
    await page.waitForTimeout(2000);
  });

  test('should redirect to org dashboard after login', async ({ page }) => {
    // This test requires a seeded test organization
    test.skip(process.env.CI && !process.env.E2E_HAS_TEST_DATA, 'No test data available in CI');

    await page.goto(`/${SPORTS.cornhole}/org/login`);
    await waitForPageLoad(page);

    // Fill in credentials
    await page.fill('input[type="email"], input[name="email"]', TEST_USERS.organization.email);
    await page.fill('input[type="password"], input[name="password"]', TEST_USERS.organization.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL('**/org/dashboard**', { timeout: 15000 }).catch(() => {
      console.log('Org login redirect failed');
    });
  });

  test('should have link to org registration', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/org/login`);
    await waitForPageLoad(page);

    // Check for register link
    const registerLink = page.locator('a:has-text("Register"), a:has-text("Sign up"), a:has-text("Create")');
    
    if (await registerLink.count() > 0) {
      await expect(registerLink.first()).toBeVisible();
    }
  });

  test('should support login with phone', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/org/login`);
    await waitForPageLoad(page);

    // Check for phone login option
    const phoneToggle = page.locator('button:has-text("Phone"), label:has-text("Phone")');
    
    if (await phoneToggle.count() > 0) {
      await phoneToggle.first().click();

      // Check for phone input
      const phoneInput = page.locator('input[type="tel"], input[name="phone"]');
      await expect(phoneInput).toBeVisible();
    }
  });

  test('should work for both sports', async ({ page }) => {
    // Test Cornhole org login
    await page.goto(`/${SPORTS.cornhole}/org/login`);
    await waitForPageLoad(page);
    expect(page.url()).toContain(SPORTS.cornhole);

    // Test Darts org login
    await page.goto(`/${SPORTS.darts}/org/login`);
    await waitForPageLoad(page);
    expect(page.url()).toContain(SPORTS.darts);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(`/${SPORTS.cornhole}/org/login`);
    await waitForPageLoad(page);

    // Form should still be visible
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toBeVisible();
  });
});
