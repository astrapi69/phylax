import { test, expect } from '@playwright/test';

test('app loads and shows the Phylax heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Phylax' })).toBeVisible();
});
