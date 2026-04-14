import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession, unlockApp } from './helpers';

const DEFAULT_PASSWORD = 'test-password-12';

test.describe('Theme', () => {
  test('header toggle cycles auto -> light -> dark -> auto', async ({ page }) => {
    await setupAuthenticatedSession(page);

    const toggle = page.getByRole('button', { name: /Aktuelles Theme/ });
    await expect(toggle).toBeVisible();
    // Fresh session: default is "auto".
    await expect(page.locator('[data-testid="theme-icon-auto"]')).toBeVisible();

    await toggle.click();
    await expect(page.locator('[data-testid="theme-icon-light"]')).toBeVisible();

    await toggle.click();
    await expect(page.locator('[data-testid="theme-icon-dark"]')).toBeVisible();

    await toggle.click();
    await expect(page.locator('[data-testid="theme-icon-auto"]')).toBeVisible();
  });

  test('theme choice persists across reloads', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // Cycle to dark. From auto: one click -> light, two clicks -> dark.
    const toggle = page.getByRole('button', { name: /Aktuelles Theme/ });
    await toggle.click();
    await toggle.click();
    await expect(page.locator('[data-testid="theme-icon-dark"]')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Reload locks the app (key store is in-memory). Unlock and confirm.
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await unlockApp(page, { password: DEFAULT_PASSWORD });
    await expect(page.locator('[data-testid="theme-icon-dark"]')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('settings radio reflects and changes the header toggle state', async ({ page }) => {
    await setupAuthenticatedSession(page);

    await page.getByRole('link', { name: 'Einstellungen' }).click();
    await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();

    await page.getByRole('radio', { name: /Dunkel/ }).check();
    await expect(page.locator('[data-testid="theme-icon-dark"]')).toBeVisible();

    await page.getByRole('radio', { name: /Hell/ }).check();
    await expect(page.locator('[data-testid="theme-icon-light"]')).toBeVisible();
  });
});
