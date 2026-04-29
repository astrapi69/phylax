import { devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';

/**
 * Shared Playwright settings for dev and production configs.
 *
 * Any setting that must stay identical across environments lives here.
 * Per-environment configs spread these into their defineConfig() call
 * and add env-specific fields (testDir, baseURL, webServer command/port)
 * alongside.
 *
 * Drift history: the initial dev vs production mismatch on `locale` caused
 * a 92-test production failure. Centralising shared settings here prevents
 * the same class of regression by construction.
 */

/**
 * Top-level fields shared across dev and production.
 */
export const baseConfig: Pick<
  PlaywrightTestConfig,
  'fullyParallel' | 'forbidOnly' | 'retries' | 'workers' | 'reporter'
> = {
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
};

/**
 * Shared `use` block. The `locale: 'de-DE'` pin is load-bearing:
 * post-I18N-02-e the i18n detector reads navigator.language first, which
 * Chromium reports as en-US by default. Without this pin every DE-label
 * assertion in either suite flips to English, producing the 92-test
 * production failure that motivated this base module.
 *
 * Consumers should spread `baseUse` and add env-specific fields such as
 * `baseURL` next to it.
 */
export const baseUse: NonNullable<PlaywrightTestConfig['use']> = {
  locale: 'de-DE',
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
};

/**
 * Default project list. F-06b adds Firefox and WebKit alongside the
 * original Chromium project so the dev + production e2e suites both
 * run across all three engines on every CI invocation. The official
 * `mcr.microsoft.com/playwright:v<x>-noble` container image ships
 * all three browsers pre-baked, so the only cost is suite duration.
 *
 * Consuming configs assign `projects: baseProjects` directly. If a
 * future requirement needs divergence (e.g. a production-only theme
 * matrix), override or extend the field locally; the default stays
 * a single source of truth.
 */
export const baseProjects: PlaywrightTestConfig['projects'] = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  },
];
