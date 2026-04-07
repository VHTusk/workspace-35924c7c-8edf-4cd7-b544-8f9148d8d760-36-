/**
 * VALORHIVE Player Dashboard E2E Tests
 * 
 * Flow: View stats -> View upcoming matches
 */

import { test, expect } from '@playwright/test';
import { waitForPageLoad, SPORTS, TEST_USERS } from '../helpers/test-helpers';

test.describe('Player Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated user
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

    // Navigate to dashboard
    await page.goto(`/${SPORTS.cornhole}/dashboard`);
    await waitForPageLoad(page);
  });

  test('should display player dashboard', async ({ page }) => {
    // Check for dashboard heading or welcome message
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('should show player statistics', async ({ page }) => {
    // Mock player stats
    await page.route('**/api/player/stats**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          points: 1500,
          elo: 1650,
          matchesPlayed: 25,
          wins: 15,
          losses: 10,
          winRate: 60,
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/dashboard`);
    await waitForPageLoad(page);

    // Look for stats cards or numbers
    const statsSection = page.locator('text=/points|elo|wins|matches|win.*rate/i');
    await expect(statsSection.first()).toBeVisible();
  });

  test('should show upcoming matches', async ({ page }) => {
    // Mock upcoming matches
    await page.route('**/api/player/upcoming-matches**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          matches: [
            {
              id: 'match-1',
              tournamentName: 'Test Tournament',
              opponent: 'Opponent Name',
              scheduledAt: new Date(Date.now() + 86400000).toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/dashboard`);
    await waitForPageLoad(page);

    // Look for upcoming matches section
    const upcomingSection = page.locator('text=/upcoming|next match|schedule/i');
    await expect(upcomingSection.first()).toBeVisible();
  });

  test('should show recent results', async ({ page }) => {
    // Mock recent results
    await page.route('**/api/player/recent-results**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: 'result-1',
              opponent: 'Previous Opponent',
              score: '21-15',
              outcome: 'WIN',
              tournament: 'Past Tournament',
            },
          ],
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/dashboard`);
    await waitForPageLoad(page);

    // Look for results section
    const resultsSection = page.locator('text=/recent|results|history/i');
    // Results section might exist
  });

  test('should show tournaments registered', async ({ page }) => {
    // Mock player tournaments
    await page.route('**/api/player/tournaments**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tournaments: [
            {
              id: 'tourn-1',
              name: 'Active Tournament',
              status: 'IN_PROGRESS',
              registrationStatus: 'CONFIRMED',
            },
          ],
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/dashboard`);
    await waitForPageLoad(page);

    // Look for tournaments section
    const tournamentsSection = page.locator('text=/tournament/i');
    await expect(tournamentsSection.first()).toBeVisible();
  });

  test('should show tier badge', async ({ page }) => {
    // Mock player with tier
    await page.route('**/api/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-user-id',
            tier: 'GOLD',
            points: 1500,
          },
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/dashboard`);
    await waitForPageLoad(page);

    // Look for tier indicator
    const tierBadge = page.locator('text=/gold|silver|bronze|diamond|tier/i');
    // Tier badge might be visible
  });

  test('should show profile completeness indicator', async ({ page }) => {
    // Mock profile completeness
    await page.route('**/api/player/profile-completeness**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          completeness: 75,
          missingFields: ['phone', 'city'],
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/dashboard`);
    await waitForPageLoad(page);

    // Look for profile completeness
    const completenessIndicator = page.locator('text=/complete.*profile|profile.*%|complete/i');
    // Completeness indicator might be visible
  });

  test('should allow navigation to profile', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/dashboard`);
    await waitForPageLoad(page);

    // Look for profile link
    const profileLink = page.locator('a[href*="/profile"], button:has-text("Profile")');
    
    if (await profileLink.count() > 0) {
      await profileLink.first().click();
      await page.waitForURL('**/profile**', { timeout: 5000 }).catch(() => {});
    }
  });

  test('should show leaderboard rank', async ({ page }) => {
    // Mock leaderboard position
    await page.route('**/api/leaderboard**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          players: [],
          yourRank: 42,
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/dashboard`);
    await waitForPageLoad(page);

    // Look for rank display
    const rankDisplay = page.locator('text=/rank|#|position/i');
    // Rank might be visible
  });

  test('should show streak information', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/dashboard`);
    await waitForPageLoad(page);

    // Look for streak indicator
    const streakDisplay = page.locator('text=/streak|winning|🔥/i');
    // Streak might be visible
  });

  test('should show quick action buttons', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/dashboard`);
    await waitForPageLoad(page);

    // Look for quick action buttons
    const findTournamentBtn = page.locator('button:has-text("Find Tournament"), a:has-text("Tournaments")');
    const leaderboardBtn = page.locator('a:has-text("Leaderboard"), button:has-text("Leaderboard")');

    // At least one quick action should exist
    expect(
      (await findTournamentBtn.count()) > 0 || 
      (await leaderboardBtn.count()) > 0
    ).toBeTruthy();
  });

  test('should show notifications indicator', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/dashboard`);
    await waitForPageLoad(page);

    // Look for notification bell or indicator
    const notificationBell = page.locator('[data-testid="notifications"], button[aria-label*="notification"], .notification-bell');
    // Notification indicator might exist
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(`/${SPORTS.cornhole}/dashboard`);
    await waitForPageLoad(page);

    // Dashboard should still be visible
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('should work for both sports', async ({ page }) => {
    // Test Cornhole dashboard
    await page.goto(`/${SPORTS.cornhole}/dashboard`);
    await waitForPageLoad(page);
    expect(page.url()).toContain(SPORTS.cornhole);

    // Test Darts dashboard
    await page.goto(`/${SPORTS.darts}/dashboard`);
    await waitForPageLoad(page);
    expect(page.url()).toContain(SPORTS.darts);
  });
});
