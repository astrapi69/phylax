import { defineConfig } from '@playwright/test';
import { baseConfig, baseProjects, baseUse } from './playwright.config.base';

export default defineConfig({
  ...baseConfig,
  testDir: 'tests/e2e',
  use: {
    ...baseUse,
    baseURL: 'http://localhost:6173',
  },
  projects: baseProjects,
  webServer: {
    // Direct npm call: Playwright manages this child process directly.
    // Wrapping with `make` adds a layer that interferes with signal handling during teardown.
    command: 'npm run dev',
    port: 6173,
    reuseExistingServer: !process.env.CI,
  },
});
