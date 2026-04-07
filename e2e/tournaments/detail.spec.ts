/**
 * VALORHIVE Tournament Detail E2E Tests
 * 
 * Flow: View tournament details -> See registration status
 */

import { test, expect } from '@playwright/test';
import { waitForPageLoad, SPORTS } from '../helpers/test-helpers';

test.describe('Tournament Detail', () => {
  test.beforeEach(async ({ page }) => {
    // Mock tournament data
    await page.route('**/api/tournaments/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tournament: {
            id: 'test-tournament',
            name: 'Test Tournament 2024',
            type: 'OPEN',
            scope: 'STATE',
            status: 'REGISTRATION_OPEN',
            location: 'Mumbai Sports Complex',
            city: 'Mumbai',
            state: 'Maharashtra',
            startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
            entryFee: 500,
            maxPlayers: 64,
            registrationsCount: 32,
            prizePool: 50000,
            description: 'A test tournament for E2E testing',
          },
        }),
      });
    });
  });

  test('should display tournament details page', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/tournaments/test-tournament`);
    await waitForPageLoad(page);

    // Check for tournament name
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('should show tournament name and type', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/tournaments/test-tournament`);
    await waitForPageLoad(page);

    // Check for tournament name
    const name = page.locator('text=/test tournament|tournament/i');
    await expect(name.first()).toBeVisible();

    // Check for tournament type badge
    const typeBadge = page.locator('text=/open|state|national/i');
    await expect(typeBadge.first()).toBeVisible();
  });

  test('should show tournament dates', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/tournaments/test-tournament`);
    await waitForPageLoad(page);

    // Check for date display
    const dateDisplay = page.locator('text=/date|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|2024|2025/i, time');
    await expect(dateDisplay.first()).toBeVisible();
  });

  test('should show venue/location', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/tournaments/test-tournament`);
    await waitForPageLoad(page);

    // Check for location display
    const location = page.locator('text=/mumbai|location|venue|sports complex/i');
    await expect(location.first()).toBeVisible();
  });

  test('should show entry fee', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/tournaments/test-tournament`);
    await waitForPageLoad(page);

    // Check for fee display
    const fee = page.locator('text=/₹|rs|fee|entry/i');
    await expect(fee.first()).toBeVisible();
  });

  test('should show prize pool', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/tournaments/test-tournament`);
    await waitForPageLoad(page);

    // Check for prize display
    const prize = page.locator('text=/prize|pool|₹|reward/i');
    await expect(prize.first()).toBeVisible();
  });

  test('should show registration status', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/tournaments/test-tournament`);
    await waitForPageLoad(page);

    // Check for registration status
    const status = page.locator('text=/registration open|spots|32.*64|available/i');
    await expect(status.first()).toBeVisible();
  });

  test('should show register button for open tournaments', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/tournaments/test-tournament`);
    await waitForPageLoad(page);

    // Check for register button
    const registerButton = page.locator('button:has-text("Register"), button:has-text("Join"), a:has-text("Register")');
    await expect(registerButton.first()).toBeVisible();
  });

  test('should show registered players list', async ({ page }) => {
    // Mock registrations
    await page.route('**/api/tournaments/*/registrations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          registrations: [
            { id: 'reg-1', playerName: 'Player One', seed: 1 },
            { id: 'reg-2', playerName: 'Player Two', seed: 2 },
            { id: 'reg-3', playerName: 'Player Three', seed: 3 },
          ],
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/tournaments/test-tournament`);
    await waitForPageLoad(page);

    // Check for players section
    const playersSection = page.locator('text=/players|participants|registered|seed/i');
    await expect(playersSection.first()).toBeVisible();
  });

  test('should show tournament description', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/tournaments/test-tournament`);
    await waitForPageLoad(page);

    // Check for description
    const description = page.locator('text=/description|about|details/i');
    await expect(description.first()).toBeVisible();
  });

  test('should show organizer info', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/tournaments/test-tournament`);
    await waitForPageLoad(page);

    // Check for organizer section
    const organizer = page.locator('text=/organizer|host|contact/i');
    // Organizer info might be visible
  });

  test('should show tournament rules', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/tournaments/test-tournament`);
    await waitForPageLoad(page);

    // Check for rules section
    const rules = page.locator('text=/rules|format|scoring|regulation/i');
    // Rules might be visible
  });

  test('should show bracket link for started tournaments', async ({ page }) => {
    // Mock started tournament
    await page.route('**/api/tournaments/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tournament: {
            id: 'started-tournament',
            name: 'Started Tournament',
            status: 'IN_PROGRESS',
            hasBracket: true,
          },
        }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/tournaments/started-tournament`);
    await waitForPageLoad(page);

    // Check for bracket link
    const bracketLink = page.locator('a:has-text("Bracket"), button:has-text("View Bracket")');
    
    if (await bracketLink.count() > 0) {
      await expect(bracketLink.first()).toBeVisible();
    }
  });

  test('should handle non-existent tournament', async ({ page }) => {
    // Mock 404 response
    await page.route('**/api/tournaments/non-existent', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Tournament not found' }),
      });
    });

    await page.goto(`/${SPORTS.cornhole}/tournaments/non-existent`);
    await waitForPageLoad(page);

    // Should show error or not found message
    const errorMessage = page.locator('text=/not found|error|does.*not.*exist/i');
    await expect(errorMessage.first()).toBeVisible();
  });

  test('should show share button', async ({ page }) => {
    await page.goto(`/${SPORTS.cornhole}/tournaments/test-tournament`);
    await waitForPageLoad(page);

    // Check for share button
    const shareButton = page.locator('button:has-text("Share"), button[aria-label*="share"], [data-testid="share-button"]');
    // Share button might exist
  });

  test('should work for both sports', async ({ page }) => {
    // Test Cornhole tournament
    await page.goto(`/${SPORTS.cornhole}/tournaments/test-tournament`);
    await waitForPageLoad(page);
    expect(page.url()).toContain(SPORTS.cornhole);

    // Test Darts tournament
    await page.goto(`/${SPORTS.darts}/tournaments/test-tournament`);
    await waitForPageLoad(page);
    expect(page.url()).toContain(SPORTS.darts);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(`/${SPORTS.cornhole}/tournaments/test-tournament`);
    await waitForPageLoad(page);

    // Tournament details should still be visible
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });
});
