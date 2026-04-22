import { test, expect, type Page } from '@playwright/test';

const VALID_PASSWORD = 'test-password-12';

async function clearDatabase(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('phylax');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

test.describe('Onboarding: first-run complete flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
  });

  test('/ -> /welcome -> /privacy -> /setup -> /profile/create', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Phylax' })).toBeVisible();

    await page.getByRole('button', { name: 'Einrichten starten' }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Du hältst den einzigen Schlüssel.' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Verstanden, weiter' }).click();
    await expect(page).toHaveURL(/\/setup$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Master-Passwort festlegen' }),
    ).toBeVisible();

    await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
    await page.getByLabel('Passwort wiederholen').fill(VALID_PASSWORD);
    await page.getByLabel('Ich habe verstanden').check();
    await page.getByRole('button', { name: 'Phylax einrichten' }).click();

    await expect(page.getByRole('heading', { name: 'Neues Profil erstellen' })).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('Onboarding: setup validation', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
  });

  test('weak password blocks submit; strong password proceeds', async ({ page }) => {
    await page.goto('/setup');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Master-Passwort festlegen' }),
    ).toBeVisible();

    await page.getByLabel('Master-Passwort').fill('short');
    await expect(page.getByText(/Mindestens 12 Zeichen/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Phylax einrichten' })).toBeDisabled();

    await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
    await page.getByLabel('Passwort wiederholen').fill(VALID_PASSWORD);
    await page.getByLabel('Ich habe verstanden').check();
    await page.getByRole('button', { name: 'Phylax einrichten' }).click();

    await expect(page.getByRole('heading', { name: 'Neues Profil erstellen' })).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('Onboarding: returning user unlock', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await page.goto('/setup');
    await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
    await page.getByLabel('Passwort wiederholen').fill(VALID_PASSWORD);
    await page.getByLabel('Ich habe verstanden').check();
    await page.getByRole('button', { name: 'Phylax einrichten' }).click();
    await expect(page.getByRole('heading', { name: 'Neues Profil erstellen' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('reload lands on /unlock and correct password proceeds', async ({ page }) => {
    await page.reload();
    await expect(page).toHaveURL(/\/unlock/);
    await expect(page.getByRole('heading', { level: 1, name: 'Phylax entsperren' })).toBeVisible();

    await page.getByLabel('Master-Passwort').fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Entsperren' }).click();
    await expect(page.getByRole('heading', { name: 'Neues Profil erstellen' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('four wrong passwords trigger lockout and countdown', async ({ page }) => {
    test.setTimeout(90_000);
    await page.reload();
    await expect(page).toHaveURL(/\/unlock/);

    // Seed three prior failures directly in sessionStorage so the 4th
    // live attempt triggers the lockout without waiting for 3 full
    // PBKDF2 derivations (each takes 1-2s at 1.2M iterations). Skips
    // ~4-6s of wall-clock time while exercising the same state
    // transition as organic failures.
    await page.evaluate(() => {
      sessionStorage.setItem(
        'phylax-unlock-rate-limit',
        JSON.stringify({ failedAttempts: 3, lockedUntil: null }),
      );
    });
    await page.reload();

    await page.getByLabel('Master-Passwort').fill('wrong-password-x');
    await page.getByRole('button', { name: 'Entsperren' }).click();

    // After the 4th failure the rate-limiter sets a 2s lockout. Assert
    // the countdown text + disabled input appear while the lockout is
    // still active.
    await expect(page.getByText(/Gesperrt/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Master-Passwort')).toBeDisabled();
  });
});

test.describe('Onboarding: backup import from welcome', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
  });

  test('select .phylax file and decrypt through to /profile or /profile/create', async ({
    page,
  }) => {
    const backupPassword = 'backup-password-e2e';

    // Navigate to welcome, follow the secondary link.
    await page.goto('/welcome');
    await page.getByRole('link', { name: 'Ich habe bereits ein Backup' }).click();
    await expect(page).toHaveURL(/\/backup\/import\/select$/);

    // Build a valid `.phylax` file in-browser using the app's crypto APIs.
    const backupJson = await page.evaluate(async (password: string) => {
      const SALT_LEN = 32;
      const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_LEN));
      const pwBytes = new TextEncoder().encode(password);
      const baseKey = await globalThis.crypto.subtle.importKey('raw', pwBytes, 'PBKDF2', false, [
        'deriveKey',
      ]);
      const key = await globalThis.crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 1_200_000, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
      const inner = {
        schemaVersion: 2,
        rows: {
          profiles: [
            {
              id: 'e2e-profile',
              profileId: 'e2e-profile',
              createdAt: 1,
              updatedAt: 2,
              baseData: { profileType: 'self' },
            },
          ],
        },
        meta_settings: { settings: { autoLockMinutes: 5 } },
      };
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const plaintext = new TextEncoder().encode(JSON.stringify(inner));
      const ciphertext = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        plaintext,
      );
      const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(ciphertext), iv.byteLength);

      const toBase64 = (bytes: Uint8Array): string => {
        let binary = '';
        for (const b of bytes) binary += String.fromCharCode(b);
        return btoa(binary);
      };

      return JSON.stringify({
        version: 1,
        type: 'phylax-backup',
        created: '2026-04-20T00:00:00Z',
        source: { app: 'phylax', appVersion: '0.0.0' },
        crypto: {
          algorithm: 'AES-256-GCM',
          kdf: 'PBKDF2-SHA256',
          iterations: 1_200_000,
          salt: toBase64(salt),
        },
        data: toBase64(combined),
      });
    }, backupPassword);

    await page.setInputFiles('#backup-file-input', {
      name: 'test-backup.phylax',
      mimeType: 'application/json',
      buffer: Buffer.from(backupJson, 'utf-8'),
    });

    await expect(page.getByTestId('backup-metadata')).toBeVisible();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page).toHaveURL(/\/backup\/import\/unlock$/);

    await page.getByLabel('Backup-Passwort').fill(backupPassword);
    await page.getByRole('button', { name: 'Importieren' }).click();

    // Post-import: navigate to /profile (profile exists in dump) or
    // /profile/create. Profile-view may further decide what to render.
    await expect(page).toHaveURL(/\/profile(\/create)?$/, { timeout: 15_000 });
  });
});

test.describe('Onboarding: defensive routes', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
  });

  test('/onboarding (removed in 01c) no longer serves the legacy flow', async ({ page }) => {
    // Fresh install with no vault: ProtectedRoute catches the attempt
    // to reach /onboarding (which matches only the catch-all inside
    // ProtectedRoute) and redirects to /welcome per the 01f fix.
    // Before 01f this path redirected to the removed /onboarding
    // itself, producing an infinite redirect loop bounced by React
    // Router; the fix routes fresh installs through /welcome.
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/welcome$/, { timeout: 5_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Phylax' })).toBeVisible();
  });
});
