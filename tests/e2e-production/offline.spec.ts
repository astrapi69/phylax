import { test, expect } from '@playwright/test';

test.describe('Offline support (production build)', () => {
  test('app loads offline after first visit', async ({ browserName, context, page }) => {
    // WebKit's Playwright driver throws "WebKit encountered an internal
    // error" on any page navigation (reload or goto) while
    // context.setOffline(true) is active. An in-page fetch() does not
    // help either, because setOffline cuts the request at the network
    // layer before Workbox's NavigationRoute can intercept it (the
    // route only fires for request.mode === 'navigate'). Until the
    // upstream webkit driver bug is fixed, skip on webkit; chromium and
    // firefox still cover the offline-cache contract.
    test.skip(browserName === 'webkit', 'WebKit driver bug on navigation while offline');

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
