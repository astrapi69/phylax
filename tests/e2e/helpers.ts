import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const DEFAULT_PASSWORD = 'test-password-12';
const DEFAULT_PROFILE_NAME = 'Test-Profil';

/**
 * Pin the app language to German before the first React render.
 *
 * Post-I18N-02-e, `src/i18n/detector.ts` picks the initial language
 * from `localStorage.phylax-language` then falls back to
 * `navigator.language`. Playwright's default Chromium reports
 * `en-US`, which would flip the DE-label-based e2e assertions to
 * English. Writing the storage key before any navigation pins the
 * app to German for the whole test run.
 *
 * Tests that exercise EN or auto-detection override this in their
 * own `beforeEach` by clearing or setting the key explicitly.
 */
export async function pinLanguageToGerman(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('phylax-language', 'de');
    } catch {
      /* ignore */
    }
  });
}

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

  await pinLanguageToGerman(page);

  // Clear IndexedDB
  await page.goto('/');
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('phylax');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
  // Post-ONB-01f: /setup is reached directly. /welcome + /privacy are
  // informational screens and are exercised by the canonical first-run
  // e2e scenario in onboarding.spec.ts; this helper skips them to keep
  // setup cost low for tests that only need an authenticated session.
  await page.goto('/setup');

  // Setup form
  await page.getByLabel('Master-Passwort').first().fill(password);
  await page.getByLabel('Passwort wiederholen').fill(password);
  await page.getByLabel('Ich habe verstanden').check();
  // Submit gates on the @zxcvbn-ts strength score, which relies on
  // an async-loaded dictionary chunk (ADR-0014). On chromium the
  // chunk lands in a few ms and the submit enables in time for
  // Playwright's auto-actionability wait. On webkit the chunk
  // sometimes lands later than Playwright's 30s click-actionability
  // window, so the click times out with "element is not enabled".
  // Wait explicitly with a generous budget so the dictionary has a
  // chance to settle before we click.
  const submitBtn = page.getByRole('button', { name: 'Phylax einrichten' });
  await expect(submitBtn).toBeEnabled({ timeout: 30000 });
  await submitBtn.click();

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
