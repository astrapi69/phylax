import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import 'fake-indexeddb/auto';
import i18n from '../../i18n/config';
import { lock } from '../../crypto';
import { resetDatabase, setupCompletedOnboarding } from '../../db/test-helpers';
import * as parseBackupModule from './parseBackupFile';
import { BackupImportSelectView } from './BackupImportSelectView';

function validBase64(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) bytes[i] = i & 0xff;
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function validEnvelope() {
  return {
    version: 1,
    type: 'phylax-backup',
    created: '2026-04-20T15:30:00Z',
    source: { app: 'phylax', appVersion: '0.0.0' },
    crypto: {
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: 1_200_000,
      salt: validBase64(32),
    },
    data: validBase64(64),
  };
}

function makePhylaxFile(name = 'mybackup.phylax'): File {
  return new File([JSON.stringify(validEnvelope())], name, { type: 'application/json' });
}

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/backup/import/select']}>
      <Routes>
        <Route path="/backup/import/select" element={<BackupImportSelectView />} />
        <Route path="/backup/import/unlock" element={<div data-testid="destination-unlock" />} />
        <Route path="/welcome" element={<div data-testid="destination-welcome" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  lock();
  await resetDatabase();
  if (i18n.language !== 'de') {
    await i18n.changeLanguage('de');
  }
});

describe('BackupImportSelectView', () => {
  it('renders heading and file picker', () => {
    renderView();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Backup importieren' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Datei auswählen')).toBeInTheDocument();
  });

  it('continue button disabled before a file is selected', () => {
    renderView();
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled();
  });

  it('displays metadata after a valid file is selected', async () => {
    const user = userEvent.setup();
    renderView();

    const input = screen.getByLabelText('Datei auswählen') as HTMLInputElement;
    await user.upload(input, makePhylaxFile('test.phylax'));

    await waitFor(() => expect(screen.getByTestId('backup-metadata')).toBeInTheDocument());
    expect(screen.getByText('test.phylax')).toBeInTheDocument();
    expect(screen.getByText('Phylax 0.0.0')).toBeInTheDocument();
  });

  it('displays a parse error for invalid JSON', async () => {
    const user = userEvent.setup();
    renderView();

    const bad = new File(['not-json'], 'bad.phylax', { type: 'application/json' });
    const input = screen.getByLabelText('Datei auswählen') as HTMLInputElement;
    await user.upload(input, bad);

    await waitFor(() =>
      expect(screen.getByText('Die ausgewählte Datei ist kein gültiges JSON.')).toBeInTheDocument(),
    );
  });

  it('shows overwrite warning and gates continue when vault exists', async () => {
    await setupCompletedOnboarding('existing-vault-pw');
    const user = userEvent.setup();
    renderView();

    await waitFor(() =>
      expect(screen.getByText(/Achtung: Import überschreibt bestehende Daten/)).toBeInTheDocument(),
    );

    await user.upload(
      screen.getByLabelText('Datei auswählen') as HTMLInputElement,
      makePhylaxFile(),
    );
    await waitFor(() => expect(screen.getByTestId('backup-metadata')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled();

    await user.click(screen.getByLabelText('Ich verstehe, dass die Daten überschrieben werden.'));

    expect(screen.getByRole('button', { name: 'Weiter' })).toBeEnabled();
  });

  it('renders English translations when i18n is en', async () => {
    await i18n.changeLanguage('en');
    renderView();
    expect(screen.getByRole('heading', { level: 1, name: 'Import backup' })).toBeInTheDocument();
    await i18n.changeLanguage('de');
  });

  describe('renderParseError variants', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    async function uploadAndExpect(
      forcedError: import('./parseBackupFile').ParseError,
      pattern: RegExp,
    ) {
      vi.spyOn(parseBackupModule, 'parseBackupFile').mockResolvedValue({
        valid: false,
        error: forcedError,
      });
      const user = userEvent.setup();
      renderView();
      const input = screen.getByLabelText('Datei auswählen') as HTMLInputElement;
      await user.upload(input, makePhylaxFile('test.phylax'));
      await waitFor(() => expect(screen.getByText(pattern)).toBeInTheDocument());
    }

    it('missing-field surfaces the field-name interpolated message (line 36)', async () => {
      await uploadAndExpect(
        { kind: 'missing-field', field: 'crypto' },
        /Datei unvollständig.*crypto/i,
      );
    });

    it('unsupported-version surfaces the version-interpolated message (lines 37-38)', async () => {
      await uploadAndExpect(
        { kind: 'unsupported-version', version: 99 },
        /Datei-Version 99 wird nicht unterstützt/i,
      );
    });

    it('wrong-type surfaces the wrong-type message (lines 39-40)', async () => {
      await uploadAndExpect(
        { kind: 'wrong-type', got: 'not-phylax' },
        /keine Phylax-Backup-Datei/i,
      );
    });

    it('too-large surfaces the size-interpolated message (lines 41-42)', async () => {
      await uploadAndExpect({ kind: 'too-large', sizeMb: 99 }, /Datei zu groß.*99 MB/i);
    });

    it('corrupted surfaces the corrupted message (lines 43-44)', async () => {
      await uploadAndExpect(
        { kind: 'corrupted', detail: 'salt base64 invalid' },
        /Backup ist beschädigt/i,
      );
    });
  });
});
