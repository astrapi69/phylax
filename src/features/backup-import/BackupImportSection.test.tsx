import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import 'fake-indexeddb/auto';

vi.mock('../../crypto', async (importOriginal) => {
  const { buildCryptoMockModule } = await import('../../crypto/testHelpers/mockDeriveKey');
  return buildCryptoMockModule(importOriginal);
});

import i18n from '../../i18n/config';
import { encrypt, generateSalt, deriveKeyFromPassword, lock } from '../../crypto';
import { PBKDF2_ITERATIONS } from '../../crypto/constants';
import { resetDatabase } from '../../db/test-helpers';
import { __resetScrollLockForTest } from '../../ui';
import { BackupImportSection } from './BackupImportSection';
import { BACKUP_IMPORT_STORAGE_KEY } from '../unlock/rateLimit';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function makeBackupBlob(password: string): Promise<File> {
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
  const fileBody = JSON.stringify({
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
  });
  return new File([fileBody], 'phylax-test-backup.phylax', { type: 'application/json' });
}

beforeEach(async () => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
  __resetScrollLockForTest();
  lock();
  await resetDatabase();
  sessionStorage.removeItem(BACKUP_IMPORT_STORAGE_KEY);
});

function renderInRouter() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<BackupImportSection />} />
        <Route path="/profile" element={<div data-testid="destination-profile" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BackupImportSection', () => {
  it('renders heading + description + file picker on mount', () => {
    renderInRouter();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Backup wiederherstellen' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('backup-import-section-file-input')).toBeInTheDocument();
    expect(screen.queryByTestId('backup-import-section-metadata')).toBeNull();
    expect(screen.queryByTestId('backup-import-section-acknowledge')).toBeNull();
    expect(screen.queryByTestId('backup-import-section-password-input')).toBeNull();
  });

  it('parsing a valid file reveals metadata + acknowledge checkbox', async () => {
    const user = userEvent.setup();
    const file = await makeBackupBlob('correct-password');
    renderInRouter();

    await user.upload(screen.getByTestId('backup-import-section-file-input'), file);
    await waitFor(() =>
      expect(screen.getByTestId('backup-import-section-metadata')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('backup-import-section-acknowledge')).toBeInTheDocument();
    // Password input still hidden until acknowledge.
    expect(screen.queryByTestId('backup-import-section-password-input')).toBeNull();
  });

  it('acknowledging reveals password input', async () => {
    const user = userEvent.setup();
    const file = await makeBackupBlob('correct-password');
    renderInRouter();

    await user.upload(screen.getByTestId('backup-import-section-file-input'), file);
    await waitFor(() =>
      expect(screen.getByTestId('backup-import-section-acknowledge')).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId('backup-import-section-acknowledge'));
    expect(screen.getByTestId('backup-import-section-password-input')).toBeInTheDocument();
  });

  it('submit button is disabled until file + ack + password all present', async () => {
    const user = userEvent.setup();
    const file = await makeBackupBlob('correct-password');
    renderInRouter();

    expect(screen.getByTestId('backup-import-section-submit')).toBeDisabled();

    await user.upload(screen.getByTestId('backup-import-section-file-input'), file);
    await waitFor(() =>
      expect(screen.getByTestId('backup-import-section-acknowledge')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('backup-import-section-submit')).toBeDisabled();

    await user.click(screen.getByTestId('backup-import-section-acknowledge'));
    expect(screen.getByTestId('backup-import-section-submit')).toBeDisabled();

    await user.type(screen.getByTestId('backup-import-section-password-input'), 'pw');
    expect(screen.getByTestId('backup-import-section-submit')).not.toBeDisabled();
  });

  it('submit click opens ConfirmDialog with destructive variant', async () => {
    const user = userEvent.setup();
    const file = await makeBackupBlob('correct-password');
    renderInRouter();

    await user.upload(screen.getByTestId('backup-import-section-file-input'), file);
    await waitFor(() =>
      expect(screen.getByTestId('backup-import-section-acknowledge')).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId('backup-import-section-acknowledge'));
    await user.type(screen.getByTestId('backup-import-section-password-input'), 'correct-password');
    await user.click(screen.getByTestId('backup-import-section-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('backup-import-confirm-dialog')).toBeInTheDocument(),
    );
    const dialog = screen.getByTestId('backup-import-confirm-dialog');
    expect(dialog).toHaveAttribute('role', 'alertdialog');
  });

  it('cancel from ConfirmDialog leaves state intact', async () => {
    const user = userEvent.setup();
    const file = await makeBackupBlob('correct-password');
    renderInRouter();

    await user.upload(screen.getByTestId('backup-import-section-file-input'), file);
    await waitFor(() =>
      expect(screen.getByTestId('backup-import-section-acknowledge')).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId('backup-import-section-acknowledge'));
    await user.type(screen.getByTestId('backup-import-section-password-input'), 'pw');
    await user.click(screen.getByTestId('backup-import-section-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('backup-import-confirm-dialog')).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId('backup-import-confirm-cancel'));
    expect(screen.queryByTestId('backup-import-confirm-dialog')).toBeNull();
    // Password still in the input so user can retry without retyping.
    expect(screen.getByTestId('backup-import-section-password-input')).toHaveValue('pw');
  });

  it('happy path: confirm runs the import and shows success banner', async () => {
    const user = userEvent.setup();
    const file = await makeBackupBlob('correct-password');
    renderInRouter();

    await user.upload(screen.getByTestId('backup-import-section-file-input'), file);
    await waitFor(() =>
      expect(screen.getByTestId('backup-import-section-acknowledge')).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId('backup-import-section-acknowledge'));
    await user.type(screen.getByTestId('backup-import-section-password-input'), 'correct-password');
    await user.click(screen.getByTestId('backup-import-section-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('backup-import-confirm-dialog')).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId('backup-import-confirm-confirm'));

    await waitFor(() => expect(screen.getByTestId('backup-import-success')).toBeInTheDocument(), {
      timeout: 5000,
    });
    lock();
  });

  it('wrong password: ConfirmDialog confirm leads to inline error, no success', async () => {
    const user = userEvent.setup();
    const file = await makeBackupBlob('correct-password');
    renderInRouter();

    await user.upload(screen.getByTestId('backup-import-section-file-input'), file);
    await waitFor(() =>
      expect(screen.getByTestId('backup-import-section-acknowledge')).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId('backup-import-section-acknowledge'));
    await user.type(screen.getByTestId('backup-import-section-password-input'), 'wrong-password');
    await user.click(screen.getByTestId('backup-import-section-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('backup-import-confirm-dialog')).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId('backup-import-confirm-confirm'));

    await waitFor(
      () => expect(screen.getByTestId('backup-import-section-error')).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.queryByTestId('backup-import-success')).toBeNull();
  });

  it('parse error renders inline when an invalid file is selected', async () => {
    const user = userEvent.setup();
    renderInRouter();
    const badFile = new File(['not-json'], 'broken.phylax', { type: 'application/json' });
    await user.upload(screen.getByTestId('backup-import-section-file-input'), badFile);
    await waitFor(() =>
      expect(screen.getByTestId('backup-import-section-parse-error')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('backup-import-section-metadata')).toBeNull();
  });
});
