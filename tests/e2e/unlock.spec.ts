import { test, expect } from '@playwright/test';

const VALID_PASSWORD = 'test-password-12';

/**
 * Helper: run the onboarding flow via the UI to create a meta row.
 */
async function completeOnboarding(page: import('@playwright/test').Page) {
  await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
  await page.getByLabel('Passwort wiederholen').fill(VALID_PASSWORD);
  await page.getByLabel('Ich habe verstanden').check();
  await page.getByRole('button', { name: 'Phylax einrichten' }).click();
  await expect(page.getByText('Phylax', { exact: true })).toBeVisible({ timeout: 10000 });
}

test.describe('Unlock flow', () => {
  test.beforeEach(async ({ page }) => {
    // Fresh database
    await page.goto('/');
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase('phylax');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
    await page.reload();

    // Complete onboarding first
    await completeOnboarding(page);

    // Reload to get the unlock screen (keyStore cleared on reload)
    await page.reload();
  });

  test('after onboarding and reload, unlock screen appears', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Phylax entsperren' })).toBeVisible();
    await expect(page.getByLabel('Master-Passwort')).toBeVisible();
  });

  test('wrong password shows error, user can retry', async ({ page }) => {
    await page.getByLabel('Master-Passwort').fill('wrong-password1');
    await page.getByRole('button', { name: 'Entsperren' }).click();

    await expect(page.getByText('Falsches Passwort.')).toBeVisible({ timeout: 10000 });

    // Can retry: clear and type correct password
    await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
    // Error should be cleared
    await expect(page.getByText('Falsches Passwort.')).not.toBeVisible();
  });

  test('correct password unlocks and navigates to main', async ({ page }) => {
    await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Entsperren' }).click();

    await expect(page.getByText('Phylax', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('after unlock and reload, unlock screen appears again', async ({ page }) => {
    // Unlock
    await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Entsperren' }).click();
    await expect(page.getByText('Phylax', { exact: true })).toBeVisible({ timeout: 10000 });

    // Reload: keyStore not persisted, so unlock screen appears
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Phylax entsperren' })).toBeVisible();
  });
});
