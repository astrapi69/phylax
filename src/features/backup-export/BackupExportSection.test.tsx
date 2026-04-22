import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';

vi.mock('../../crypto', async (importOriginal) => {
  const { buildCryptoMockModule } = await import('../../crypto/testHelpers/mockDeriveKey');
  return buildCryptoMockModule(importOriginal);
});

import i18n from '../../i18n/config';
import { lock, unlockWithKey, deriveKeyFromPassword } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { ProfileRepository } from '../../db/repositories';
import { BackupExportSection } from './BackupExportSection';

const TEST_PASSWORD = 'vault-password-long';

async function setupWithProfile(): Promise<void> {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const meta = await readMeta();
  const saltBytes = new Uint8Array(meta?.salt ?? new ArrayBuffer(0));
  const key = await deriveKeyFromPassword(TEST_PASSWORD, saltBytes);
  unlockWithKey(key);
  const repo = new ProfileRepository();
  await repo.create({
    baseData: {
      weightHistory: [],
      knownDiagnoses: [],
      currentMedications: [],
      relevantLimitations: [],
      profileType: 'self',
    },
    warningSigns: [],
    externalReferences: [],
    version: '1.0',
  });
}

beforeEach(async () => {
  if (typeof URL.createObjectURL !== 'function') {
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () =>
      'blob:mock';
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    (URL as unknown as { revokeObjectURL: (url: string) => void }).revokeObjectURL = () => {};
  }
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  if (i18n.language !== 'de') {
    void i18n.changeLanguage('de');
  }
});

describe('BackupExportSection', () => {
  it('renders heading, description, and disabled submit initially', async () => {
    await setupWithProfile();
    render(<BackupExportSection />);
    expect(screen.getByRole('heading', { name: 'Verschlüsseltes Backup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Backup erstellen' })).toBeDisabled();
  });

  it('enables submit once the password meets the minimum length', async () => {
    await setupWithProfile();
    const user = userEvent.setup();
    render(<BackupExportSection />);
    const input = screen.getByLabelText('Passwort');
    await user.type(input, 'long-enough-12');
    expect(screen.getByRole('button', { name: 'Backup erstellen' })).toBeEnabled();
  });

  it('shows the success panel with filename after a successful export', async () => {
    await setupWithProfile();
    const user = userEvent.setup();
    render(<BackupExportSection />);
    await user.type(screen.getByLabelText('Passwort'), 'long-enough-12');
    await user.click(screen.getByRole('button', { name: 'Backup erstellen' }));
    await waitFor(() =>
      expect(screen.getByText(/Backup mit dem eingegebenen Passwort/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/phylax-backup-\d{8}-\d{6}\.phylax/)).toBeInTheDocument();
  });

  it('renders an error message when the keystore is locked', async () => {
    lock();
    const user = userEvent.setup();
    render(<BackupExportSection />);
    await user.type(screen.getByLabelText('Passwort'), 'long-enough-12');
    await user.click(screen.getByRole('button', { name: 'Backup erstellen' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/App ist gesperrt/i));
  });

  it('"Weiteres Backup erstellen" resets the form', async () => {
    await setupWithProfile();
    const user = userEvent.setup();
    render(<BackupExportSection />);
    await user.type(screen.getByLabelText('Passwort'), 'long-enough-12');
    await user.click(screen.getByRole('button', { name: 'Backup erstellen' }));
    await screen.findByText(/Backup mit dem eingegebenen Passwort/i);
    await user.click(screen.getByRole('button', { name: 'Weiteres Backup erstellen' }));
    expect(screen.getByRole('button', { name: 'Backup erstellen' })).toBeDisabled();
  });

  it('renders English translations when i18n language is en', async () => {
    await setupWithProfile();
    await i18n.changeLanguage('en');
    render(<BackupExportSection />);
    expect(screen.getByRole('heading', { name: 'Encrypted backup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create backup' })).toBeInTheDocument();
    await i18n.changeLanguage('de');
  });
});
