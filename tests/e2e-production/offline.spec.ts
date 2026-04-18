import { test, expect } from '@playwright/test';

test.describe('Offline support (production build)', () => {
  test('app loads offline after first visit', async ({ context, page }) => {
    // First visit: service worker installs and precaches assets
    await page.goto('./');
    await expect(page.locator('h1')).toBeVisible();

    // Wait for service worker to activate and finish caching.
    // In production, Workbox precaches all assets during SW install.
    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.active?.state === 'activated';
      },
      undefined,
      { timeout: 15000 },
    );

    // Additional wait for precache to complete
    await page.waitForTimeout(2000);

    // Simulate offline
    await context.setOffline(true);

    // Reload: should load entirely from service worker cache
    await page.reload();

    // The app should still render (onboarding screen on fresh install)
    await expect(page.locator('h1')).toBeVisible();

    // Restore online
    await context.setOffline(false);
  });
});
