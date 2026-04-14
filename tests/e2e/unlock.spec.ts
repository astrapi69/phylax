import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession, unlockApp } from './helpers';

const VALID_PASSWORD = 'test-password-12';

test.describe('Unlock flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page, { password: VALID_PASSWORD });
    // Reload to lock (keyStore not persisted)
    await page.reload();
  });

  test('after setup and reload, unlock screen appears', async ({ page }) => {
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
    await unlockApp(page, { password: VALID_PASSWORD });
    await expect(page.getByRole('heading', { level: 1, name: 'Test-Profil' })).toBeVisible({
      timeout: 10000,
    });
  });

  test('after unlock and reload, unlock screen appears again', async ({ page }) => {
    await unlockApp(page, { password: VALID_PASSWORD });
    await expect(page.getByRole('heading', { level: 1, name: 'Test-Profil' })).toBeVisible({
      timeout: 10000,
    });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Phylax entsperren' })).toBeVisible();
  });
});
