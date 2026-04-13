import { test, expect } from '@playwright/test';

const VALID_PASSWORD = 'test-password-12';

async function completeOnboarding(page: import('@playwright/test').Page) {
  await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
  await page.getByLabel('Passwort wiederholen').fill(VALID_PASSWORD);
  await page.getByLabel('Ich habe verstanden').check();
  await page.getByRole('button', { name: 'Phylax einrichten' }).click();
  await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible({ timeout: 10000 });
}

test.describe('Unlock flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase('phylax');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
    await page.reload();
    await completeOnboarding(page);
    await page.reload();
  });

  test('after onboarding and reload, unlock screen appears', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Phylax entsperren' })).toBeVisible();
  });

  test('wrong password shows error, user can retry', async ({ page }) => {
    await page.getByLabel('Master-Passwort').fill('wrong-password1');
    await page.getByRole('button', { name: 'Entsperren' }).click();
    await expect(page.getByText('Falsches Passwort.')).toBeVisible({ timeout: 10000 });

    await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
    await expect(page.getByText('Falsches Passwort.')).not.toBeVisible();
  });

  test('correct password unlocks and navigates to profile', async ({ page }) => {
    await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Entsperren' }).click();
    await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible({ timeout: 10000 });
  });

  test('after unlock and reload, unlock screen appears again', async ({ page }) => {
    await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Entsperren' }).click();
    await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible({ timeout: 10000 });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Phylax entsperren' })).toBeVisible();
  });
});
