import { test, expect } from '@playwright/test';

const VALID_PASSWORD = 'test-password-12';

test.describe('Onboarding flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear IndexedDB before each test to ensure fresh state
    await page.goto('/');
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase('phylax');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
    await page.reload();
  });

  test('fresh app shows onboarding screen', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Phylax einrichten' })).toBeVisible();
    await expect(page.getByLabel('Master-Passwort')).toBeVisible();
  });

  test('weak password shows error and submit is not available', async ({ page }) => {
    await page.getByLabel('Master-Passwort').fill('short');
    await expect(page.getByText('Mindestens 12 Zeichen')).toBeVisible();
    // Confirm field should not be present yet
    await expect(page.getByLabel('Passwort wiederholen')).not.toBeVisible();
  });

  test('full onboarding flow arrives at main app', async ({ page }) => {
    // Enter valid password
    await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);

    // Confirm password
    await page.getByLabel('Passwort wiederholen').fill(VALID_PASSWORD);

    // Accept warning
    await page.getByLabel('Ich habe verstanden').check();

    // Submit
    await page.getByRole('button', { name: 'Phylax einrichten' }).click();

    // Wait for derivation and redirect to main
    await expect(page.getByText('Phylax', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('reload after onboarding shows locked screen, not onboarding', async ({ page }) => {
    // Complete onboarding
    await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
    await page.getByLabel('Passwort wiederholen').fill(VALID_PASSWORD);
    await page.getByLabel('Ich habe verstanden').check();
    await page.getByRole('button', { name: 'Phylax einrichten' }).click();

    // Wait for main screen
    await expect(page.getByText('Phylax', { exact: true })).toBeVisible({ timeout: 10000 });

    // Reload
    await page.reload();

    // Should NOT show onboarding again (meta row persists)
    await expect(page.getByRole('heading', { name: 'Phylax einrichten' })).not.toBeVisible();
    // Should show the unlock screen
    await expect(page.getByRole('heading', { name: 'Phylax entsperren' })).toBeVisible();
  });
});
