import { test, expect } from '@playwright/test';

const VALID_PASSWORD = 'test-password-12';

test.describe('Profile creation', () => {
  test.beforeEach(async ({ page }) => {
    // Fresh database + complete onboarding (lands on /profile/create)
    await page.goto('/');
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase('phylax');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
    // Navigate explicitly to the legacy /onboarding route; `/` now
    // redirects fresh installs to /welcome (ONB-01a). /onboarding stays
    // as fallback until ONB-01c lands SetupView.
    await page.goto('/onboarding');

    // Complete onboarding
    await page.getByLabel('Master-Passwort').first().fill(VALID_PASSWORD);
    await page.getByLabel('Passwort wiederholen').fill(VALID_PASSWORD);
    await page.getByLabel('Ich habe verstanden').check();
    await page.getByRole('button', { name: 'Phylax einrichten' }).click();

    // Wait for profile-create
    await expect(page.getByRole('heading', { name: 'Neues Profil erstellen' })).toBeVisible({
      timeout: 10000,
    });
  });

  test('after onboarding, user is redirected to /profile/create', async ({ page }) => {
    await expect(page).toHaveURL(/\/profile\/create/);
    await expect(page.getByLabel('Profilname')).toBeVisible();
  });

  test('filling self profile and submitting redirects to /profile', async ({ page }) => {
    await page.getByLabel('Profilname').fill('Mein Profil');
    await page.getByRole('button', { name: 'Profil erstellen' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Mein Profil' })).toBeVisible({
      timeout: 10000,
    });
    await expect(page).toHaveURL(/\/profile$/);
  });

  test('filling proxy profile with managedBy creates and redirects', async ({ page }) => {
    await page.getByLabel('Profilname').fill('Mutters Profil');
    await page.getByText('Stellvertretend fuer jemand anderen').click();
    await page.getByLabel('Dein Name (als Betreuer)').fill('Asterios');
    await page.getByRole('button', { name: 'Profil erstellen' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Mutters Profil' })).toBeVisible({
      timeout: 10000,
    });
  });
});
