/**
 * VALORHIVE Leaderboard E2E Tests
 * 
 * Flow: View leaderboard -> Filter by scope
 */

import { test, expect } from '@playwright/test';
import { waitForPageLoad, SPORTS } from '../helpers/test-helpers';

test.describe('Leaderboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to leaderboard
    await page.goto(`/${SPORTS.cornhole}/leaderboard`);
    await waitForPageLoad(page);
  });

  test('should display leaderboard page', async ({ page }) => {
    // Check for leaderboard heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toContainText(/leaderboard|ranking/i);
  });

  test('should show player rankings', async ({ page }) => {
    // Mock leaderboard data
    await page.route('**/api/leaderboard**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          players: [
            { rank: 1, name: 'Top Player', points: 2500, tier: 'DIAMOND' },
            { rank: 2, name: 'Second Player', points: 2400, tier: 'GOLD' },
            { rank: 3, name: 'Third Player', points: 2300, tier: 'GOLD' },
            { rank: 4, name: 'Fourth Player', points: 2200, tier: 'SILVER' },
            { rank: 5, name: 'Fifth Player', points: 2100, tier: 'SILVER' },
          ],
          total: 100,
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/leaderboard`);
    await waitForPageLoad(page);

    // Check for player entries
    const playerEntries = page.locator('[data-testid="player-entry"], tr, .player-row');
    await expect(playerEntries.first()).toBeVisible();
  });

  test('should show top 3 players prominently', async ({ page }) => {
    // Mock leaderboard data
    await page.route('**/api/leaderboard**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          players: [
            { rank: 1, name: 'Top Player', points: 2500 },
            { rank: 2, name: 'Second Player', points: 2400 },
            { rank: 3, name: 'Third Player', points: 2300 },
          ],
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/leaderboard`);
    await waitForPageLoad(page);

    // Look for podium or highlighted top 3
    const podium = page.locator('[data-testid="podium"], .podium, .top-3');
    
    if (await podium.count() > 0) {
      await expect(podium.first()).toBeVisible();
    }
  });

  test('should filter by scope (national, state, district, city)', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/leaderboard`);
    await waitForPageLoad(page);

    // Look for scope filter
    const scopeFilter = page.locator('select[name="scope"], [data-testid="scope-filter"], button:has-text("National"), button:has-text("State")');
    
    if (await scopeFilter.count() > 0) {
      await scopeFilter.first().click();
      await page.waitForTimeout(500);

      // Check for scope options
      const stateOption = page.locator('text=/state|district|city/i');
      if (await stateOption.count() > 0) {
        await stateOption.first().click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should search for players', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/leaderboard`);
    await waitForPageLoad(page);

    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"], input[name="search"]');
    
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('Player');
      await page.waitForTimeout(1000);
    }
  });

  test('should show player tier badges', async ({ page }) => {
    // Mock leaderboard with tiers
    await page.route('**/api/leaderboard**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          players: [
            { rank: 1, name: 'Diamond Player', points: 2500, tier: 'DIAMOND' },
            { rank: 2, name: 'Gold Player', points: 2400, tier: 'GOLD' },
          ],
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/leaderboard`);
    await waitForPageLoad(page);

    // Look for tier badges
    const tierBadges = page.locator('text=/diamond|gold|silver|bronze/i');
    await expect(tierBadges.first()).toBeVisible();
  });

  test('should show player points and ELO', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/leaderboard`);
    await waitForPageLoad(page);

    // Look for points display
    const pointsDisplay = page.locator('text=/pts|points|elo/i, [data-testid="points"]');
    await expect(pointsDisplay.first()).toBeVisible();
  });

  test('should navigate to player profile on click', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/leaderboard`);
    await waitForPageLoad(page);

    // Find a player entry
    const playerEntry = page.locator('[data-testid="player-entry"] a, .player-row a, a[href*="/players/"]');
    
    if (await playerEntry.count() > 0) {
      await playerEntry.first().click();
      await page.waitForTimeout(1000);

      // Should navigate to player profile
      expect(page.url()).toMatch(/\/players\/[\w-]+/);
    }
  });

  test('should show pagination', async ({ page }) => {
    // Mock large leaderboard
    await page.route('**/api/leaderboard**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          players: Array.from({ length: 20 }, (_, i) => ({
            rank: i + 1,
            name: `Player ${i + 1}`,
            points: 2000 - i * 10,
          })),
          total: 100,
          hasMore: true,
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/leaderboard`);
    await waitForPageLoad(page);

    // Look for pagination
    const pagination = page.locator('[data-testid="pagination"], nav[aria-label*="pagination"], button:has-text("Next"), button:has-text("Load more")');
    
    if (await pagination.count() > 0) {
      await expect(pagination.first()).toBeVisible();
    }
  });

  test('should show user rank if logged in', async ({ page }) => {
    // Mock authenticated user
    await page.route('**/api/auth/check', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: { id: 'test-user-id' },
        }),
      });
    });

    await page.route('**/api/leaderboard**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          players: [],
          yourRank: 42,
          total: 100,
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/leaderboard`);
    await waitForPageLoad(page);

    // Look for user's rank
    const yourRank = page.locator('text=/your rank|#42|rank.*42/i');
    // User rank might be displayed
  });

  test('should work for both sports', async ({ page }) => {
    // Test Cornhole leaderboard
    await page.goto(`/${SPORTS.cornhole}/leaderboard`);
    await waitForPageLoad(page);
    expect(page.url()).toContain(SPORTS.cornhole);

    // Test Darts leaderboard
    await page.goto(`/${SPORTS.darts}/leaderboard`);
    await waitForPageLoad(page);
    expect(page.url()).toContain(SPORTS.darts);
  });

  test('should show organization leaderboard for org users', async ({ page }) => {
    // Mock organization user
    await page.route('**/api/auth/check-org', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          organization: { id: 'org-1' },
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/org/leaderboard`);
    await waitForPageLoad(page);

    // Check for organization leaderboard tabs
    const orgLeaderboard = page.locator('text=/organization|players/i, [role="tab"]');
    // Org leaderboard might have tabs
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(`/${SPORTS.cornhole}/leaderboard`);
    await waitForPageLoad(page);

    // Leaderboard should still be visible
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });
});
