import { defineConfig } from '@playwright/test';
import { baseConfig, baseProjects, baseUse } from './playwright.config.base';

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
  ...baseConfig,
  testDir: 'tests/e2e-production',
  use: {
    ...baseUse,
    // Production build uses base=/phylax/ for GitHub Pages deployment (D-01).
    // The preview server mirrors that base path, so the test baseURL must
    // include it; otherwise requests to '/' hit the root and 404.
    baseURL: 'http://localhost:6174/phylax/',
  },
  projects: baseProjects,
  webServer: {
    // Direct npm call: Playwright manages this child process directly.
    // Wrapping with `make` adds a layer that interferes with signal handling during teardown.
    command: 'npm run preview',
    port: 6174,
    reuseExistingServer: !process.env.CI,
  },
});
