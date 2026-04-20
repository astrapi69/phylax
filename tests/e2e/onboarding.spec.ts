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
    // Post-ONB-01a, `/` redirects fresh-install users to /welcome (stub).
    // These tests exercise the legacy /onboarding route which remains as
    // fallback until ONB-01c replaces the old OnboardingFlow. ONB-01c
    // rewrites these tests to target the new first-run flow.
    await page.goto('/onboarding');
  });

  test('fresh app shows onboarding screen', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Phylax einrichten' })).toBeVisible();
    await expect(page.getByLabel('Master-Passwort')).toBeVisible();
  });

  test('weak password shows error and submit is not available', async ({ page }) => {
    await page.getByLabel('Master-Passwort').fill('short');
    await expect(page.getByText('Mindestens 12 Zeichen')).toBeVisible();
    await expect(page.getByLabel('Passwort wiederholen')).not.toBeVisible();
  });

  test('full onboarding flow arrives at profile-create', async ({ page }) => {
    await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
    await page.getByLabel('Passwort wiederholen').fill(VALID_PASSWORD);
    await page.getByLabel('Ich habe verstanden').check();
    await page.getByRole('button', { name: 'Phylax einrichten' }).click();

    // After onboarding, navigates to /profile/create (no profile yet)
    await expect(page.getByRole('heading', { name: 'Neues Profil erstellen' })).toBeVisible({
      timeout: 10000,
    });
  });

  test('reload after onboarding shows unlock screen', async ({ page }) => {
    await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
    await page.getByLabel('Passwort wiederholen').fill(VALID_PASSWORD);
    await page.getByLabel('Ich habe verstanden').check();
    await page.getByRole('button', { name: 'Phylax einrichten' }).click();

    await expect(page.getByRole('heading', { name: 'Neues Profil erstellen' })).toBeVisible({
      timeout: 10000,
    });

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Phylax einrichten' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Phylax entsperren' })).toBeVisible();
  });
});
