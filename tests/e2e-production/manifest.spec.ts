import { test, expect } from '@playwright/test';

test.describe('PWA manifest (production build)', () => {
  test('manifest is served with correct fields from production build', async ({ page }) => {
    await page.goto('/');

    const manifestHref = await page.evaluate(() => {
      const link = document.querySelector('link[rel="manifest"]');
      return link?.getAttribute('href');
    });

    expect(manifestHref).toBeTruthy();

    const response = await page.goto(manifestHref ?? '/manifest.webmanifest');
    expect(response?.status()).toBe(200);

    const manifest = await response?.json();
    expect(manifest.name).toBe('Phylax');
    expect(manifest.short_name).toBe('Phylax');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
  });

  test('service worker registers and activates in production', async ({ page }) => {
    await page.goto('/');

    const swActive = await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.active?.state === 'activated';
      },
      undefined,
      { timeout: 15000 },
    );

    expect(swActive).toBeTruthy();
  });
});
