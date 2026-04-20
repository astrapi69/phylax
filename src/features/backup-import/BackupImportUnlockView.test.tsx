import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import 'fake-indexeddb/auto';
import i18n from '../../i18n/config';
import { encrypt, generateSalt, deriveKeyFromPassword, lock } from '../../crypto';
import { PBKDF2_ITERATIONS } from '../../crypto/constants';
import { resetDatabase } from '../../db/test-helpers';
import { BackupImportUnlockView } from './BackupImportUnlockView';
import type { ParsedPhylaxFile } from './parseBackupFile';
import { BACKUP_IMPORT_STORAGE_KEY, createRateLimiter } from '../unlock/rateLimit';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function makeBackup(password: string): Promise<ParsedPhylaxFile> {
  const salt = generateSalt();
  const key = await deriveKeyFromPassword(password, salt);
  const inner = {
    schemaVersion: 2,
    rows: {
      profiles: [{ id: 'p1', profileId: 'p1', createdAt: 1, updatedAt: 2 }],
    },
    meta_settings: {},
  };
  const plaintext = new TextEncoder().encode(JSON.stringify(inner));
  const ciphertext = await encrypt(key, plaintext);
  return {
    version: 1,
    type: 'phylax-backup',
    created: '2026-04-20T00:00:00Z',
    source: { app: 'phylax', appVersion: '0.0.0' },
    crypto: {
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: PBKDF2_ITERATIONS,
      salt: bytesToBase64(salt),
    },
    data: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

function renderView(parsed: ParsedPhylaxFile | null, fileName = 'test.phylax') {
  const state = parsed === null ? null : { parsed, fileName };
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/backup/import/unlock', state }]}>
      <Routes>
        <Route path="/backup/import/select" element={<div data-testid="destination-select" />} />
        <Route path="/backup/import/unlock" element={<BackupImportUnlockView />} />
        <Route path="/profile" element={<div data-testid="destination-profile" />} />
        <Route path="/profile/create" element={<div data-testid="destination-create" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  lock();
  await resetDatabase();
  sessionStorage.removeItem(BACKUP_IMPORT_STORAGE_KEY);
  if (i18n.language !== 'de') {
    await i18n.changeLanguage('de');
  }
});

describe('BackupImportUnlockView', () => {
  it('redirects to select when state is missing', () => {
    renderView(null);
    expect(screen.getByTestId('destination-select')).toBeInTheDocument();
  });

  it('renders heading and filename readout when state is present', async () => {
    const parsed = await makeBackup('test-backup-pw');
    renderView(parsed, 'example.phylax');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Backup entsperren' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/example\.phylax/)).toBeInTheDocument();
  });

  it('wrong password shows error', async () => {
    const user = userEvent.setup();
    const parsed = await makeBackup('correct-password');
    renderView(parsed);

    await user.type(screen.getByLabelText('Backup-Passwort'), 'wrong-password-x');
    await user.click(screen.getByRole('button', { name: 'Importieren' }));

    await waitFor(
      () =>
        expect(
          screen.getByText(/Falsches Passwort. Backup konnte nicht entschluesselt werden./),
        ).toBeInTheDocument(),
      { timeout: 10_000 },
    );
  });

  it('correct password populates vault and navigates to /profile', async () => {
    const user = userEvent.setup();
    const parsed = await makeBackup('correct-password-long');
    renderView(parsed);

    await user.type(screen.getByLabelText('Backup-Passwort'), 'correct-password-long');
    await user.click(screen.getByRole('button', { name: 'Importieren' }));

    await waitFor(() => expect(screen.getByTestId('destination-profile')).toBeInTheDocument(), {
      timeout: 10_000,
    });
    lock();
  });

  it('shows countdown when backup-import rate-limiter is active', async () => {
    const limiter = createRateLimiter(BACKUP_IMPORT_STORAGE_KEY);
    limiter.recordFailedAttempt();
    limiter.recordFailedAttempt();
    limiter.recordFailedAttempt();
    limiter.recordFailedAttempt();

    const parsed = await makeBackup('whatever');
    renderView(parsed);

    expect(screen.getByText(/Gesperrt/)).toBeInTheDocument();
    expect(screen.getByLabelText('Backup-Passwort')).toBeDisabled();
  });

  it('renders English translations when i18n is en', async () => {
    await i18n.changeLanguage('en');
    const parsed = await makeBackup('correct-password');
    renderView(parsed);
    expect(screen.getByRole('heading', { level: 1, name: 'Unlock backup' })).toBeInTheDocument();
    await i18n.changeLanguage('de');
  });
});
