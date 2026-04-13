import { test, expect } from '@playwright/test';

test('app loads and shows content', async ({ page }) => {
  await page.goto('/');
  // Fresh install: redirected to onboarding
  // Existing install: redirected to unlock
  // Either way, the app renders something meaningful
  await expect(page.locator('h1')).toBeVisible();
});
