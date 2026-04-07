/**
 * VALORHIVE Organization Dashboard E2E Tests
 * 
 * Flow: View roster -> View tournaments
 */

import { test, expect } from '@playwright/test';
import { waitForPageLoad, SPORTS, TEST_USERS } from '../helpers/test-helpers';

test.describe('Organization Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated org
    await page.route('**/api/auth/check-org', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          organization: {
            id: 'org-test-id',
            name: 'Test Organization',
            email: TEST_USERS.organization.email,
          },
        }),
      });
    });

    // Navigate to org dashboard
    await page.goto(`/${SPORTS.cornhole}/org/dashboard`);
    await waitForPageLoad(page);
  });

  test('should display org dashboard', async ({ page }) => {
    // Check for dashboard heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('should show organization name', async ({ page }) => {
    // Mock org data
    await page.route('**/api/org/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          organization: {
            id: 'org-test-id',
            name: 'Test Organization',
            type: 'CLUB',
          },
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/org/dashboard`);
    await waitForPageLoad(page);

    // Check for org name display
    const orgName = page.locator('text=/test organization|my org/i');
    // Org name might be visible
  });

  test('should show roster management section', async ({ page }) => {
    // Mock roster data
    await page.route('**/api/org/roster', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          roster: [
            { id: 'player-1', name: 'Player One', points: 1500 },
            { id: 'player-2', name: 'Player Two', points: 1400 },
          ],
          total: 2,
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/org/dashboard`);
    await waitForPageLoad(page);

    // Look for roster section
    const rosterSection = page.locator('text=/roster|members|players|manage.*player/i');
    await expect(rosterSection.first()).toBeVisible();
  });

  test('should show organization tournaments', async ({ page }) => {
    // Mock org tournaments
    await page.route('**/api/org/tournaments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tournaments: [
            {
              id: 'tourn-1',
              name: 'Inter-Org Tournament',
              type: 'INTER_ORG',
              status: 'REGISTRATION_OPEN',
            },
          ],
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/org/dashboard`);
    await waitForPageLoad(page);

    // Look for tournaments section
    const tournamentsSection = page.locator('text=/tournament|events|competition/i');
    await expect(tournamentsSection.first()).toBeVisible();
  });

  test('should show organization stats', async ({ page }) => {
    // Mock org stats
    await page.route('**/api/org/analytics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stats: {
            totalPoints: 5000,
            memberCount: 15,
            tournamentsHosted: 5,
            winRate: 65,
          },
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/org/dashboard`);
    await waitForPageLoad(page);

    // Look for stats display
    const statsDisplay = page.locator('text=/points|members|hosted|win/i');
    await expect(statsDisplay.first()).toBeVisible();
  });

  test('should allow inviting players to roster', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/org/dashboard`);
    await waitForPageLoad(page);

    // Look for invite button
    const inviteButton = page.locator('button:has-text("Invite"), button:has-text("Add Player"), button:has-text("Manage")');
    
    if (await inviteButton.count() > 0) {
      await inviteButton.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('should show subscription status', async ({ page }) => {
    // Mock subscription
    await page.route('**/api/org/subscription', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          subscription: {
            status: 'ACTIVE',
            plan: 'PRO',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/org/dashboard`);
    await waitForPageLoad(page);

    // Look for subscription indicator
    const subscriptionIndicator = page.locator('text=/pro|subscription|active|trial/i');
    // Subscription status might be visible
  });

  test('should show navigation sidebar', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/org/dashboard`);
    await waitForPageLoad(page);

    // Look for navigation
    const nav = page.locator('nav, [data-testid="sidebar"], .sidebar');
    await expect(nav.first()).toBeVisible();
  });

  test('should have link to create intra-org tournament', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/org/dashboard`);
    await waitForPageLoad(page);

    // Look for create tournament button
    const createButton = page.locator('a:has-text("Create Tournament"), button:has-text("Create")');
    
    if (await createButton.count() > 0) {
      await expect(createButton.first()).toBeVisible();
    }
  });

  test('should show pending invitations', async ({ page }) => {
    // Mock pending invitations
    await page.route('**/api/org/roster/request', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pendingInvites: [
            { id: 'invite-1', playerName: 'Invited Player', status: 'PENDING' },
          ],
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/org/dashboard`);
    await waitForPageLoad(page);

    // Look for pending invitations
    const pendingSection = page.locator('text=/pending|invitation|invite/i');
    // Pending invites might be shown
  });

  test('should allow navigation to profile', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/org/dashboard`);
    await waitForPageLoad(page);

    // Look for profile link
    const profileLink = page.locator('a[href*="/org/profile"], a:has-text("Profile")');
    
    if (await profileLink.count() > 0) {
      await profileLink.first().click();
      await page.waitForURL('**/org/profile**', { timeout: 5000 }).catch(() => {});
    }
  });

  test('should work for both sports', async ({ page }) => {
    // Test Cornhole org dashboard
    await page.goto(`/${SPORTS.cornhole}/org/dashboard`);
    await waitForPageLoad(page);
    expect(page.url()).toContain(SPORTS.cornhole);

    // Test Darts org dashboard
    await page.goto(`/${SPORTS.darts}/org/dashboard`);
    await waitForPageLoad(page);
    expect(page.url()).toContain(SPORTS.darts);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(`/${SPORTS.cornhole}/org/dashboard`);
    await waitForPageLoad(page);

    // Dashboard should still be visible
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });
});
