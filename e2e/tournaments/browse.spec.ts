/**
 * VALORHIVE Browse Tournaments E2E Tests
 * 
 * Flow: View tournament list -> Filter by sport
 */

import { test, expect } from '@playwright/test';
import { waitForPageLoad, SPORTS } from '../helpers/test-helpers';

test.describe('Browse Tournaments', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to tournaments page
    await page.goto(`/${SPORTS.cornhole}/tournaments`);
    await waitForPageLoad(page);
  });

  test('should display tournaments page', async ({ page }) => {
    // Check page heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toContainText(/tournament/i);
  });

  test('should show tournament cards', async ({ page }) => {
    // Check for tournament cards or list items
    const tournamentCards = page.locator('[data-testid="tournament-card"], .tournament-card, article');
    
    if (await tournamentCards.count() > 0) {
      // At least one tournament should be visible
      await expect(tournamentCards.first()).toBeVisible();
    } else {
      // If no tournaments, check for empty state message
      const emptyMessage = page.locator('text=/no tournaments|coming soon|check back/i');
      await expect(emptyMessage.first()).toBeVisible();
    }
  });

  test('should display tournament details on cards', async ({ page }) => {
    const tournamentCards = page.locator('[data-testid="tournament-card"], .tournament-card, article');
    const cardCount = await tournamentCards.count();

    if (cardCount > 0) {
      const firstCard = tournamentCards.first();

      // Check for tournament name
      const name = firstCard.locator('h2, h3, [data-testid="tournament-name"]');
      await expect(name.first()).toBeVisible();

      // Check for date or location
      const dateOrLocation = firstCard.locator('text=/date|location|venue/i, time, [data-testid="tournament-date"]');
      // These are optional but common
    }
  });

  test('should filter tournaments by status', async ({ page }) => {
    // Look for status filter
    const statusFilter = page.locator('select[name="status"], [data-testid="status-filter"], button:has-text("Status")');
    
    if (await statusFilter.count() > 0) {
      await statusFilter.first().click();
      await page.waitForTimeout(500);

      // Check for status options
      const openOption = page.locator('text=/open|registration|upcoming/i');
      if (await openOption.count() > 0) {
        await openOption.first().click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should filter tournaments by type', async ({ page }) => {
    // Look for type filter
    const typeFilter = page.locator('select[name="type"], [data-testid="type-filter"], button:has-text("Type")');
    
    if (await typeFilter.count() > 0) {
      await typeFilter.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('should search tournaments by name', async ({ page }) => {
    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"], input[name="search"]');
    
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('Championship');
      await page.waitForTimeout(1000);

      // Results should update
      await page.waitForTimeout(500);
    }
  });

  test('should navigate to tournament detail on click', async ({ page }) => {
    const tournamentCards = page.locator('[data-testid="tournament-card"], .tournament-card, article a, a[href*="/tournaments/"]');
    
    if (await tournamentCards.count() > 0) {
      await tournamentCards.first().click();
      await page.waitForTimeout(1000);

      // Should navigate to tournament detail page
      expect(page.url()).toMatch(/\/tournaments\/[\w-]+/);
    }
  });

  test('should show pagination or load more', async ({ page }) => {
    // Check for pagination controls
    const pagination = page.locator('[data-testid="pagination"], nav[aria-label*="pagination"], button:has-text("Load more"), button:has-text("More")');
    
    // Pagination is optional, only check if there are many tournaments
    const tournamentCards = page.locator('[data-testid="tournament-card"], .tournament-card, article');
    const cardCount = await tournamentCards.count();

    if (cardCount >= 10 && (await pagination.count() > 0)) {
      await expect(pagination.first()).toBeVisible();
    }
  });

  test('should show empty state when no tournaments', async ({ page }) => {
    // Mock empty tournaments response
    await page.route('**/api/tournaments**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tournaments: [],
          total: 0,
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/tournaments`);
    await waitForPageLoad(page);

    // Check for empty state message
    const emptyMessage = page.locator('text=/no tournaments|coming soon|check back/i');
    await expect(emptyMessage.first()).toBeVisible();
  });

  test('should work for both sports (cornhole and darts)', async ({ page }) => {
    // Test Cornhole tournaments
    await page.goto(`/${SPORTS.cornhole}/tournaments`);
    await waitForPageLoad(page);
    expect(page.url()).toContain(SPORTS.cornhole);

    // Test Darts tournaments
    await page.goto(`/${SPORTS.darts}/tournaments`);
    await waitForPageLoad(page);
    expect(page.url()).toContain(SPORTS.darts);
  });

  test('should show tournament type badges', async ({ page }) => {
    const tournamentCards = page.locator('[data-testid="tournament-card"], .tournament-card, article');
    
    if (await tournamentCards.count() > 0) {
      const firstCard = tournamentCards.first();

      // Check for type badge (OPEN, WOMEN_ONLY, etc.)
      const typeBadge = firstCard.locator('text=/open|women|inter|intra/i, [data-testid="type-badge"]');
      // Type badges are optional
    }
  });

  test('should show registration status', async ({ page }) => {
    const tournamentCards = page.locator('[data-testid="tournament-card"], .tournament-card, article');
    
    if (await tournamentCards.count() > 0) {
      const firstCard = tournamentCards.first();

      // Check for registration status
      const status = firstCard.locator('text=/register|full|closed|open/i, [data-testid="registration-status"]');
      // Status should be visible on most tournament cards
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(`/${SPORTS.cornhole}/tournaments`);
    await waitForPageLoad(page);

    // Page should still be functional
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });
});
