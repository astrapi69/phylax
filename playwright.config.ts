import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:6173',
    // Pin the app language to German for the whole suite. Post-I18N-02-e
    // (commit 8301afd) the detector reads navigator.language first, which
    // Chromium reports as en-US by default and would flip every
    // DE-label-based assertion to English. `locale` sets navigator.language
    // to de-DE so the detector resolves to 'de' on every fresh load,
    // including routes that run before any test-scoped localStorage pin
    // takes effect. Keep this value in lockstep with
    // `playwright.config.production.ts`; drift caused a 92-test production
    // failure when only the dev config was updated in B-02.
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
    command: 'npm run dev',
    port: 6173,
    reuseExistingServer: !process.env.CI,
  },
});
