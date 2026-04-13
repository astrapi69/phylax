import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession } from './helpers';

test.describe('Auto-lock', () => {
  test('app locks on reload (simulates session end)', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // Reload simulates session end (keyStore cleared)
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Phylax entsperren' })).toBeVisible();
  });
});
