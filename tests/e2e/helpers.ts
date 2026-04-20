import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const DEFAULT_PASSWORD = 'test-password-12';
const DEFAULT_PROFILE_NAME = 'Test-Profil';

/**
 * Complete the full onboarding + profile-create flow in the browser.
 * Leaves the user on /profile (the profile placeholder screen).
 *
 * Use this in any E2E test that needs a ready-to-use authenticated
 * state with an existing profile.
 */
export async function setupAuthenticatedSession(
  page: Page,
  options?: {
    password?: string;
    profileName?: string;
  },
): Promise<void> {
  const password = options?.password ?? DEFAULT_PASSWORD;
  const profileName = options?.profileName ?? DEFAULT_PROFILE_NAME;

  // Clear IndexedDB
  await page.goto('/');
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('phylax');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
  // Explicit /onboarding to reach the legacy setup form that E2E helpers
  // rely on. Root (`/`) routes through EntryRouter post-ONB-01a which
  // redirects first-run users to /welcome; /onboarding stays as the
  // fallback until ONB-01c ships SetupView. Helpers are updated to the
  // new first-run flow alongside ONB-01c.
  await page.goto('/onboarding');

  // Onboarding
  await page.getByLabel('Master-Passwort').first().fill(password);
  await page.getByLabel('Passwort wiederholen').fill(password);
  await page.getByLabel('Ich habe verstanden').check();
  await page.getByRole('button', { name: 'Phylax einrichten' }).click();

  // Wait for profile-create redirect
  await expect(page.getByRole('heading', { name: 'Neues Profil erstellen' })).toBeVisible({
    timeout: 10000,
  });

  // Create profile
  await page.getByLabel('Profilname').fill(profileName);
  await page.getByRole('button', { name: 'Profil erstellen' }).click();

  // Wait for profile view (H1 shows the profile's display name)
  await expect(page.getByRole('heading', { level: 1, name: profileName })).toBeVisible({
    timeout: 10000,
  });
}

/**
 * Unlock an already-onboarded app.
 * Assumes the unlock screen is currently showing.
 */
export async function unlockApp(page: Page, options?: { password?: string }): Promise<void> {
  const password = options?.password ?? DEFAULT_PASSWORD;
  await page.getByLabel('Master-Passwort').fill(password);
  await page.getByRole('button', { name: 'Entsperren' }).click();
}
