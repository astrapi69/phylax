import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for production E2E tests.
 *
 * Runs against the preview server serving the production build (dist/).
 * Used in CI after `make build` to verify:
 * - Service worker and Workbox precaching work in production
 * - Offline mode works (the test deferred from F-15)
 * - Manifest is served correctly from production assets
 */
export default defineConfig({
  testDir: 'tests/e2e-production',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    // Production build uses base=/phylax/ for GitHub Pages deployment (D-01).
    // The preview server mirrors that base path, so the test baseURL must
    // include it; otherwise requests to '/' hit the root and 404.
    baseURL: 'http://localhost:6174/phylax/',
    // Pin the app language to German for the whole suite. Post-I18N-02-e
    // (commit 8301afd) the i18n detector reads navigator.language first,
    // which Chromium reports as en-US by default and would flip every
    // DE-label-based assertion in this smoke suite to English (92 test
    // failures). Setting `locale: 'de-DE'` makes the detector resolve
    // to 'de' on every fresh load. Keep this value in lockstep with
    // `playwright.config.ts`; drift between the two configs caused the
    // initial dev vs production lag (B-02 fixed dev, this restored prod).
    locale: 'de-DE',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Direct npm call: Playwright manages this child process directly.
    // Wrapping with `make` adds a layer that interferes with signal handling during teardown.
    command: 'npm run preview',
    port: 6174,
    reuseExistingServer: !process.env.CI,
  },
});
