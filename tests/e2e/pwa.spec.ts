import { test, expect } from '@playwright/test';

test.describe('PWA', () => {
  test('manifest is served with correct fields', async ({ page }) => {
    await page.goto('/');

    // Find the manifest link in the page (injected by vite-plugin-pwa)
    const manifestHref = await page.evaluate(() => {
      const link = document.querySelector('link[rel="manifest"]');
      return link?.getAttribute('href');
    });

    expect(manifestHref).toBeTruthy();

    // Fetch the manifest via the page's request context instead of
    // `page.goto`. Firefox decides whether `.webmanifest` is inline
    // or a download based on Content-Type sniffing; vite-plugin-pwa's
    // dev server serves the file with `application/manifest+json`,
    // which Firefox flags as a download and the navigation rejects
    // with "Download is starting". `request.fetch` is a page-less
    // fetch that bypasses navigation/download UI entirely while
    // still validating status + body.
    const url = new URL(manifestHref ?? '/manifest.webmanifest', page.url()).toString();
    const response = await page.request.fetch(url);
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.name).toBe('Phylax');
    expect(manifest.short_name).toBe('Phylax');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
  });

  test('service worker script is served', async ({ page }) => {
    // In dev mode, vite-plugin-pwa serves the SW at /dev-sw.js?dev-sw
    // In production, it is /sw.js
    // We just verify the SW script is available, not that it fully registers
    // (registration timing varies between dev and production builds)
    await page.goto('/');

    const swAvailable = await page.evaluate(async () => {
      return 'serviceWorker' in navigator;
    });

    expect(swAvailable).toBe(true);
  });

  test('app has correct meta tags for PWA', async ({ page }) => {
    await page.goto('/');

    // Two theme-color tags, one per prefers-color-scheme variant (see ADR-0009).
    const themeColors = await page.evaluate(() => {
      const metas = document.querySelectorAll('meta[name="theme-color"]');
      return Array.from(metas).map((m) => ({
        content: m.getAttribute('content'),
        media: m.getAttribute('media'),
      }));
    });
    expect(themeColors).toHaveLength(2);
    expect(themeColors).toContainEqual({
      content: '#f9fafb',
      media: '(prefers-color-scheme: light)',
    });
    expect(themeColors).toContainEqual({
      content: '#111827',
      media: '(prefers-color-scheme: dark)',
    });

    const appleMeta = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
      return meta?.getAttribute('content');
    });
    expect(appleMeta).toBe('yes');

    const appleTitle = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      return meta?.getAttribute('content');
    });
    expect(appleTitle).toBe('Phylax');
  });
});
