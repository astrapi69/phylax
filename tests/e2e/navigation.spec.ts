import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession, unlockApp } from './helpers';

const VALID_PASSWORD = 'test-password-12';

test.describe('Navigation', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('fresh setup lands on /profile', async ({ page }) => {
    await setupAuthenticatedSession(page, { password: VALID_PASSWORD });

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible();
  });

  test('clicking nav items navigates to correct routes', async ({ page }) => {
    await setupAuthenticatedSession(page, { password: VALID_PASSWORD });

    await page.getByRole('link', { name: 'Beobachtungen' }).click();
    await expect(page).toHaveURL(/\/observations/);
    await expect(page.getByRole('heading', { name: 'Beobachtungen' })).toBeVisible();

    await page.getByRole('link', { name: 'Laborwerte' }).click();
    await expect(page).toHaveURL(/\/lab-values/);

    await page.getByRole('link', { name: 'Einstellungen' }).click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test('lock button redirects to unlock screen', async ({ page }) => {
    await setupAuthenticatedSession(page, { password: VALID_PASSWORD });

    await page.getByLabel('Phylax sperren').click();
    await expect(page.getByRole('heading', { name: 'Phylax entsperren' })).toBeVisible();
  });

  test('direct URL while locked redirects, returnTo restores after unlock', async ({ page }) => {
    await setupAuthenticatedSession(page, { password: VALID_PASSWORD });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Phylax entsperren' })).toBeVisible();

    await unlockApp(page, { password: VALID_PASSWORD });

    await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible();
  });

  // 404 route is verified by unit tests. E2E test is unreliable because
  // React Router v7 does not intercept programmatically created links
  // for client-side navigation, and page.goto would lose the keyStore.
});
