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

    // Verify the service worker serves the app shell from cache while
    // offline. We assert via in-page fetch instead of page.reload() /
    // page.goto() because WebKit's Playwright driver throws "WebKit
    // encountered an internal error" on any navigation while
    // context.setOffline(true) is active. The fetch() call still goes
    // through the registered service worker, so this exercises the same
    // SW cache path without triggering the driver bug.
    const result = await page.evaluate(async () => {
      const response = await fetch('./');
      return { status: response.status, body: await response.text() };
    });
    expect(result.status).toBe(200);
    expect(result.body).toContain('id="root"');

    // Restore online
    await context.setOffline(false);
  });
});
