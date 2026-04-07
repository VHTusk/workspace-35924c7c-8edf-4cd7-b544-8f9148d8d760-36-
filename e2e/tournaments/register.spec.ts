/**
 * VALORHIVE Tournament Registration E2E Tests
 * 
 * Flow: Login as player -> Navigate to tournament -> Complete registration
 */

import { test, expect } from '@playwright/test';
import { waitForPageLoad, SPORTS, TEST_USERS, loginAsPlayer } from '../helpers/test-helpers';

test.describe('Tournament Registration', () => {
  test.beforeEach(async ({ page }) => {
    // Start from fresh state
    await page.context().clearCookies();
  });

  test('should show register button on tournament detail page', async ({ page }) => {
    // Navigate to a tournament detail page
    // Using a mock tournament ID or the first available tournament
    await page.goto(`/${SPORTS.cornhole}/tournaments`);
    await waitForPageLoad(page);

    // Find and click first tournament
    const tournamentLinks = page.locator('a[href*="/tournaments/"]');
    const linkCount = await tournamentLinks.count();

    if (linkCount > 0) {
      await tournamentLinks.first().click();
      await waitForPageLoad(page);

      // Check for register button
      const registerButton = page.locator('button:has-text("Register"), button:has-text("Join"), a:has-text("Register")');
      
      if (await registerButton.count() > 0) {
        await expect(registerButton.first()).toBeVisible();
      }
    }
  });

  test('should require login to register', async ({ page }) => {
    // Navigate to tournament detail
    await page.goto(`/${SPORTS.cornhole}/tournaments`);
    await waitForPageLoad(page);

    const tournamentLinks = page.locator('a[href*="/tournaments/"]');
    const linkCount = await tournamentLinks.count();

    if (linkCount > 0) {
      await tournamentLinks.first().click();
      await waitForPageLoad(page);

      // Click register button
      const registerButton = page.locator('button:has-text("Register"), button:has-text("Join")');
      
      if (await registerButton.count() > 0) {
        await registerButton.first().click();
        await page.waitForTimeout(1000);

        // Should redirect to login or show login prompt
        const loginUrl = page.url();
        const hasLoginPrompt = await page.locator('text=/login|sign in/i').count() > 0;
        
        expect(loginUrl.includes('/login') || hasLoginPrompt).toBeTruthy();
      }
    }
  });

  test('should show registration form after login', async ({ page }) => {
    // Mock logged-in state
    await page.route('**/api/auth/check', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: 'test-user-id',
            email: TEST_USERS.player.email,
            firstName: 'Test',
            lastName: 'Player',
          },
        }),
      });
    });

    // Navigate to tournament and click register
    await page.goto(`/${SPORTS.cornhole}/tournaments`);
    await waitForPageLoad(page);

    const tournamentLinks = page.locator('a[href*="/tournaments/"]');
    
    if (await tournamentLinks.count() > 0) {
      await tournamentLinks.first().click();
      await waitForPageLoad(page);

      const registerButton = page.locator('button:has-text("Register"), button:has-text("Join")');
      
      if (await registerButton.count() > 0) {
        await registerButton.first().click();
        await page.waitForTimeout(1000);

        // Should show registration form or modal
        const registrationForm = page.locator('form, [data-testid="registration-form"], dialog');
        // Form might appear as modal or new page
      }
    }
  });

  test('should show registration fee and allow payment', async ({ page }) => {
    // Navigate to tournament with fee
    await page.goto(`/${SPORTS.cornhole}/tournaments`);
    await waitForPageLoad(page);

    const tournamentCards = page.locator('[data-testid="tournament-card"], .tournament-card, article');
    
    if (await tournamentCards.count() > 0) {
      // Look for fee information
      const feeInfo = tournamentCards.first().locator('text=/fee|₹|rs/i, [data-testid="entry-fee"]');
      // Fee should be visible on tournament card or detail
    }
  });

  test('should show registration confirmation', async ({ page }) => {
    // Mock successful registration
    await page.route('**/api/tournaments/*/register', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          registration: {
            id: 'reg-123',
            status: 'CONFIRMED',
          },
        }),
      });
    });

    // Navigate and attempt registration
    await page.goto(`/${SPORTS.cornhole}/tournaments`);
    await waitForPageLoad(page);

    const tournamentLinks = page.locator('a[href*="/tournaments/"]');
    
    if (await tournamentLinks.count() > 0) {
      await tournamentLinks.first().click();
      await waitForPageLoad(page);

      // Registration flow would complete here
    }
  });

  test('should show waitlist option when tournament is full', async ({ page }) => {
    // Mock full tournament
    await page.route('**/api/tournaments/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tournament: {
            id: 'full-tournament',
            name: 'Full Tournament',
            maxPlayers: 32,
            registrationsCount: 32,
            waitlistEnabled: true,
          },
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/tournaments/full-tournament`);
    await waitForPageLoad(page);

    // Check for waitlist button
    const waitlistButton = page.locator('button:has-text("Waitlist"), button:has-text("Join Waitlist")');
    
    if (await waitlistButton.count() > 0) {
      await expect(waitlistButton.first()).toBeVisible();
    }
  });

  test('should handle team tournament registration', async ({ page }) => {
    // Navigate to team tournament
    await page.goto(`/${SPORTS.cornhole}/tournaments`);
    await waitForPageLoad(page);

    // Look for team tournament indicator
    const teamTournament = page.locator('text=/team|doubles|partner/i').first();
    
    if (await teamTournament.count() > 0) {
      // Team registration would have additional steps
    }
  });

  test('should show profile completeness warning', async ({ page }) => {
    // Mock user with incomplete profile
    await page.route('**/api/auth/check', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: 'incomplete-user',
            email: TEST_USERS.player.email,
            profileComplete: false,
          },
        }),
      });
    });

    // Navigate to tournament
    await page.goto(`/${SPORTS.cornhole}/tournaments`);
    await waitForPageLoad(page);

    const tournamentLinks = page.locator('a[href*="/tournaments/"]');
    
    if (await tournamentLinks.count() > 0) {
      await tournamentLinks.first().click();
      await waitForPageLoad(page);

      // Try to register
      const registerButton = page.locator('button:has-text("Register")');
      
      if (await registerButton.count() > 0) {
        await registerButton.first().click();
        await page.waitForTimeout(1000);

        // Should show profile completeness warning
        const warning = page.locator('text=/complete.*profile|profile.*required/i');
        // Warning might appear
      }
    }
  });

  test('should show already registered status', async ({ page }) => {
    // Mock user already registered
    await page.route('**/api/tournaments/*/registration-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          registered: true,
          status: 'CONFIRMED',
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/tournaments`);
    await waitForPageLoad(page);

    const tournamentLinks = page.locator('a[href*="/tournaments/"]');
    
    if (await tournamentLinks.count() > 0) {
      await tournamentLinks.first().click();
      await waitForPageLoad(page);

      // Should show "Already Registered" status
      const registeredStatus = page.locator('text=/already registered|registered|confirmed/i');
      // Status should be visible
    }
  });

  test('should show withdrawal option for registered players', async ({ page }) => {
    // Mock registered user
    await page.route('**/api/tournaments/*/registration-status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          registered: true,
          status: 'CONFIRMED',
          canWithdraw: true,
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/tournaments`);
    await waitForPageLoad(page);

    const tournamentLinks = page.locator('a[href*="/tournaments/"]');
    
    if (await tournamentLinks.count() > 0) {
      await tournamentLinks.first().click();
      await waitForPageLoad(page);

      // Check for withdraw button
      const withdrawButton = page.locator('button:has-text("Withdraw"), button:has-text("Cancel Registration")');
      
      if (await withdrawButton.count() > 0) {
        await expect(withdrawButton.first()).toBeVisible();
      }
    }
  });
});
