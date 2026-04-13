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
    baseURL: 'http://localhost:6174',
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
