import { test, expect } from '@playwright/test';

test('app loads and shows content', async ({ page }) => {
  await page.goto('/');
  // Post-ONB-01a, `/` routes through EntryRouter:
  //  - Fresh install -> /welcome (stub in 01a, real view in 01b)
  //  - Existing vault + locked -> /unlock
  //  - Existing vault + unlocked -> /profile
  // Assert landing URL is one of the expected destinations rather than
  // a specific h1 (stubs have no h1 during the 01a transition window).
  await expect(page).toHaveURL(/\/(welcome|unlock|profile)/);
});
