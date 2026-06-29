import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const DEFAULT_PASSWORD = 'test-password-12';
const DEFAULT_PROFILE_NAME = 'Test-Profil';

/**
 * Fill the setup form's password + confirm pair robustly on WebKit.
 *
 * Both inputs carry autocomplete="new-password"; on WebKit, Safari's
 * Automatic Strong Password behaviour asynchronously clears the first
 * field when the second is filled, leaving the password empty and the
 * submit button disabled (BUG-13). Fill both, then assert both values
 * stuck and re-fill whichever WebKit cleared, retrying until the pair
 * is stable. Chromium and Firefox satisfy the assertion on the first
 * pass. The conditional re-fill avoids re-triggering the clear on a
 * field that already holds the value.
 *
 * The production smoke suite carries an intentional copy of this in
 * tests/e2e-production/smoke-helpers.ts (the two E2E suites keep
 * separate helper modules by design); keep the two in sync.
 */
export async function fillNewPasswordPair(page: Page, password: string): Promise<void> {
  const passwordField = page.getByLabel('Master-Passwort').first();
  const confirmField = page.getByLabel('Passwort wiederholen');
  await expect(async () => {
    if ((await passwordField.inputValue()) !== password) {
      await passwordField.fill(password);
    }
    if ((await confirmField.inputValue()) !== password) {
      await confirmField.fill(password);
    }
    await expect(passwordField).toHaveValue(password);
    await expect(confirmField).toHaveValue(password);
  }).toPass({ timeout: 15000 });
}

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

  // Setup form. The submit gate is validateSetup (password length,
  // confirm match, acknowledgment) in SetupView.tsx; the zxcvbn
  // strength score is advisory and never blocks submit. The password
  // pair is filled via the WebKit-robust helper (BUG-13).
  await fillNewPasswordPair(page, password);
  await page.getByLabel('Ich habe verstanden').check();

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
