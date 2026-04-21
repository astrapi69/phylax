import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession } from './helpers';

/**
 * B-02 backup export E2E.
 *
 * Verifies that the settings-screen section produces an encrypted
 * `.phylax` file via the browser download gesture. Does NOT attempt
 * to re-import the downloaded file; round-trip correctness is covered
 * by the `roundTrip.test.ts` Vitest integration test.
 */

const BACKUP_PASSWORD = 'backup-password-e2e';

test.describe('Backup export', () => {
  test('export produces a .phylax download with spec-compliant envelope', async ({ page }) => {
    await setupAuthenticatedSession(page);

    // SPA navigation preserves the in-memory vault key. A hard
    // `page.goto('/settings')` would reload the page and trigger
    // ProtectedRoute's redirect to `/unlock`.
    await page.getByRole('link', { name: 'Einstellungen' }).click();
    await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Datenverwaltung' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Verschluesseltes Backup' })).toBeVisible();

    // Fill password and trigger export.
    const passwordField = page.getByLabel('Passwort', { exact: true });
    await passwordField.fill(BACKUP_PASSWORD);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Backup erstellen' }).click();
    const download = await downloadPromise;

    // Filename follows the phylax-backup-YYYYMMDD-HHmmss.phylax pattern.
    const suggested = download.suggestedFilename();
    expect(suggested).toMatch(/^phylax-backup-\d{8}-\d{6}\.phylax$/);

    // Read the downloaded file contents and verify envelope shape.
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    const text = Buffer.concat(chunks).toString('utf-8');
    const parsed = JSON.parse(text) as {
      version: number;
      type: string;
      created: string;
      source: { app: string; appVersion: string };
      crypto: { algorithm: string; kdf: string; iterations: number; salt: string };
      data: string;
    };

    expect(parsed.version).toBe(1);
    expect(parsed.type).toBe('phylax-backup');
    expect(parsed.source.app).toBe('phylax');
    expect(parsed.crypto.algorithm).toBe('AES-256-GCM');
    expect(parsed.crypto.kdf).toBe('PBKDF2-SHA256');
    expect(parsed.crypto.iterations).toBe(1_200_000);

    // 32-byte salt base64-encoded to a 44-char string (padded).
    const saltBytes = Buffer.from(parsed.crypto.salt, 'base64');
    expect(saltBytes.length).toBe(32);

    // Data must be at least IV (12) + GCM tag (16) = 28 bytes.
    const dataBytes = Buffer.from(parsed.data, 'base64');
    expect(dataBytes.length).toBeGreaterThan(28);

    // Success panel visible after auto-download.
    await expect(page.getByText(/Backup mit dem eingegebenen Passwort/i)).toBeVisible();
  });
});
