import { test, expect } from '@playwright/test';

test.describe('PWA manifest (production build)', () => {
  test('manifest is served with correct fields from production build', async ({ page }) => {
    await page.goto('./');

    const manifestHref = await page.evaluate(() => {
      const link = document.querySelector('link[rel="manifest"]');
      return link?.getAttribute('href');
    });

    expect(manifestHref).toBeTruthy();

    // Fetch via the page's request context instead of `page.goto`.
    // Firefox classifies `application/manifest+json` as a download
    // and rejects the navigation with "Download is starting".
    // `request.fetch` bypasses navigation/download UI entirely
    // while still validating status + body. Mirrors the dev-side
    // `tests/e2e/pwa.spec.ts` fix.
    const url = new URL(manifestHref ?? 'manifest.webmanifest', page.url()).toString();
    const response = await page.request.fetch(url);
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.name).toBe('Phylax');
    expect(manifest.short_name).toBe('Phylax');
    expect(manifest.display).toBe('standalone');
    // D-01: production build uses /phylax/ base for GitHub Pages deployment.
    expect(manifest.start_url).toBe('/phylax/');
    expect(manifest.scope).toBe('/phylax/');
    expect(manifest.lang).toBe('de');
    expect(manifest.theme_color).toBe('#1f2937');
    expect(manifest.categories).toEqual(expect.arrayContaining(['health']));
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThanOrEqual(8);
    const maskable = manifest.icons.filter(
      (icon: { purpose?: string }) => icon.purpose === 'maskable',
    );
    expect(maskable.length).toBeGreaterThanOrEqual(2);
  });

  test('service worker registers and activates in production', async ({ page }) => {
    await page.goto('./');

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
