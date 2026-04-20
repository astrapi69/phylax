import { test, expect } from '@playwright/test';

const VALID_PASSWORD = 'test-password-12';

test.describe('Onboarding flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase('phylax');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
    // Post-ONB-01c: /welcome -> /privacy -> /setup. Tests start on
    // /setup to exercise the password-setup form directly; the welcome
    // and privacy views are covered by their own component tests.
    await page.goto('/setup');
  });

  test('setup screen shows headline and password input', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Master-Passwort festlegen' })).toBeVisible();
    await expect(page.getByLabel('Master-Passwort')).toBeVisible();
  });

  test('short password displays length validation', async ({ page }) => {
    await page.getByLabel('Master-Passwort').fill('short');
    await expect(page.getByText(/Mindestens 12 Zeichen/)).toBeVisible();
  });

  test('full setup flow arrives at profile-create', async ({ page }) => {
    await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
    await page.getByLabel('Passwort wiederholen').fill(VALID_PASSWORD);
    await page.getByLabel('Ich habe verstanden').check();
    await page.getByRole('button', { name: 'Phylax einrichten' }).click();

    await expect(page.getByRole('heading', { name: 'Neues Profil erstellen' })).toBeVisible({
      timeout: 10000,
    });
  });

  test('reload after setup lands on unlock screen', async ({ page }) => {
    await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
    await page.getByLabel('Passwort wiederholen').fill(VALID_PASSWORD);
    await page.getByLabel('Ich habe verstanden').check();
    await page.getByRole('button', { name: 'Phylax einrichten' }).click();

    await expect(page.getByRole('heading', { name: 'Neues Profil erstellen' })).toBeVisible({
      timeout: 10000,
    });

    await page.reload();

    await expect(
      page.getByRole('heading', { name: 'Master-Passwort festlegen' }),
    ).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Phylax entsperren' })).toBeVisible();
  });
});
