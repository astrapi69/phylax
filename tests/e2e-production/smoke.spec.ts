import { test, expect, type Page } from '@playwright/test';
import {
  THEME_MATRIX,
  assertBackgroundRespectsTheme,
  assertNoA11yViolations,
  assertTheme,
  prepareTheme,
  resolvedTheme,
} from './smoke-helpers';

/**
 * Smoke tests run against the production build (see playwright.config.production.ts).
 *
 * Goal: every user-facing screen renders without crashing and passes WCAG 2 A+AA
 * in light, dark, and auto modes. Not a replacement for functional E2E tests in
 * tests/e2e/; those exercise user flows, these exercise rendering + accessibility
 * per theme variant.
 *
 * To run: `make test-e2e-production` (also chained in `make ci-local-full`).
 */

async function clearDatabase(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('phylax');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
  await page.reload();
}

test.describe('Smoke: onboarding', () => {
  for (const { theme, sysPref } of THEME_MATRIX) {
    test(`onboarding renders in theme=${theme} sysPref=${sysPref}`, async ({ page }) => {
      await prepareTheme(page, theme, sysPref);
      await clearDatabase(page);
      await page.goto('/onboarding');

      const expected = resolvedTheme(theme, sysPref);
      await expect(page.getByRole('heading', { name: 'Phylax einrichten' })).toBeVisible();
      await assertTheme(page, expected);
      await assertBackgroundRespectsTheme(page, expected);
      await assertNoA11yViolations(page, { screen: 'onboarding' });
    });
  }
});
