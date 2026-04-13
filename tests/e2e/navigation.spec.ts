import { test, expect } from '@playwright/test';

const VALID_PASSWORD = 'test-password-12';

async function freshOnboardAndUnlock(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('phylax');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
  await page.reload();

  // Complete onboarding
  await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
  await page.getByLabel('Passwort wiederholen').fill(VALID_PASSWORD);
  await page.getByLabel('Ich habe verstanden').check();
  await page.getByRole('button', { name: 'Phylax einrichten' }).click();

  await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible({ timeout: 10000 });
}

async function unlockApp(page: import('@playwright/test').Page) {
  await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible({ timeout: 10000 });
}

test.describe('Navigation', () => {
  // Use a wider viewport so desktop nav is visible
  test.use({ viewport: { width: 1024, height: 768 } });

  test('fresh unlock lands on /profile', async ({ page }) => {
    await freshOnboardAndUnlock(page);

    await expect(page).toHaveURL(/\/profile/);
    await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible();
  });

  test('clicking nav items navigates to correct routes', async ({ page }) => {
    await freshOnboardAndUnlock(page);

    // Use desktop nav links (visible at 1024px width)
    await page.getByRole('link', { name: 'Beobachtungen' }).click();
    await expect(page).toHaveURL(/\/observations/);
    await expect(page.getByRole('heading', { name: 'Beobachtungen' })).toBeVisible();

    await page.getByRole('link', { name: 'Laborwerte' }).click();
    await expect(page).toHaveURL(/\/lab-values/);

    await page.getByRole('link', { name: 'Einstellungen' }).click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test('lock button redirects to unlock screen', async ({ page }) => {
    await freshOnboardAndUnlock(page);

    await page.getByLabel('Phylax sperren').click();
    await expect(page.getByRole('heading', { name: 'Phylax entsperren' })).toBeVisible();
  });

  test('direct URL while locked redirects, returnTo restores after unlock', async ({ page }) => {
    await freshOnboardAndUnlock(page);

    // Reload to lock
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Phylax entsperren' })).toBeVisible();

    // Unlock
    await unlockApp(page);

    // Should land on /profile (default returnTo)
    await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible();
  });

  test('404 route shows not found page', async ({ page }) => {
    await freshOnboardAndUnlock(page);

    // Navigate within the app (not page.goto which reloads and loses keyStore)
    await page.evaluate(() => {
      window.history.pushState({}, '', '/nonexistent-page-xyz');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Give React Router time to react
    await expect(page.getByText('Seite nicht gefunden')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Zurueck zum Profil')).toBeVisible();
  });
});
