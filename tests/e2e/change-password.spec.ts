import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession, unlockApp } from './helpers';

const OLD_PASSWORD = 'test-password-12';
const NEW_PASSWORD = 'next-password-345';

/**
 * P-06 end-to-end happy path: setup -> change password -> lock ->
 * unlock with new password works -> old password rejected.
 *
 * Component-level negative cases (mismatch, weak-new, same-as-current,
 * wrong-current) live in `ChangePasswordSection.test.tsx`. The E2E
 * spec stays focused on the integration surface: the section is
 * mounted in SettingsScreen, the operation actually re-encrypts the
 * vault on disk, and the lock-then-unlock cycle observes the new
 * password as the active credential.
 */
test('change master password: full lock-unlock cycle', async ({ page }) => {
  await setupAuthenticatedSession(page);

  // Navigate to /settings via the in-app NavBar link. `page.goto`
  // would trigger a full reload that clears the in-memory keyStore
  // key and lands on the unlock screen; SPA-internal navigation via
  // a click preserves the unlocked session.
  await page.getByRole('link', { name: 'Einstellungen' }).click();
  await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();

  // Fill the change-password form.
  await page.getByLabel('Aktuelles Master-Passwort').fill(OLD_PASSWORD);
  await page.getByLabel('Neues Master-Passwort').fill(NEW_PASSWORD);
  await page.getByLabel('Passwort bestätigen').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Master-Passwort ändern' }).click();

  // Confirmation modal -> confirm.
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Ja, ändern' }).click();

  // Success banner.
  await expect(page.getByText(/Master-Passwort wurde erfolgreich geändert/i)).toBeVisible({
    timeout: 30000,
  });

  // Lock via the header lock button (aria-label "Phylax sperren").
  await page.getByRole('button', { name: /Phylax sperren/i }).click();
  await expect(page.getByRole('heading', { name: /Phylax entsperren/i })).toBeVisible();

  // Old password is rejected.
  await unlockApp(page, { password: OLD_PASSWORD });
  await expect(page.getByText(/Falsches Passwort/i)).toBeVisible({ timeout: 10000 });

  // New password unlocks the vault and renders the protected app.
  await page.getByLabel('Master-Passwort').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page).toHaveURL(/\/(profile|observations|settings)/, { timeout: 15000 });
});
