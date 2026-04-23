import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../i18n/config';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding, resetDatabase } from '../../db/test-helpers';
import { ProfileRepository, DocumentRepository } from '../../db/repositories';
import { DocumentList } from './DocumentList';

const TEST_PASSWORD = 'test-password-12';

async function unlockCurrent(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function seedProfile(): Promise<string> {
  const profile = await new ProfileRepository().create({
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
  return profile.id;
}

async function seedPdf(profileId: string, filename: string): Promise<string> {
  const repo = new DocumentRepository();
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  const doc = await repo.create({
    profileId,
    filename,
    mimeType: 'application/pdf',
    sizeBytes: bytes.byteLength,
    content: bytes.buffer,
  });
  return doc.id;
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
  if (i18n.language !== 'de') {
    void i18n.changeLanguage('de');
  }
});

describe('DocumentList', () => {
  it('renders the loading placeholder while the hook is loading', async () => {
    await seedProfile();
    render(
      <MemoryRouter>
        <DocumentList />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('documents-loading')).toBeInTheDocument();
  });

  it('renders the empty state when no documents exist for the profile', async () => {
    await seedProfile();
    render(
      <MemoryRouter>
        <DocumentList />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('documents-empty')).toBeInTheDocument());
  });

  it('renders the no-profile error when no profile is set', async () => {
    await resetDatabase();
    await setupCompletedOnboarding(TEST_PASSWORD);
    await unlockCurrent();

    render(
      <MemoryRouter>
        <DocumentList />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('documents-error')).toBeInTheDocument());
    expect(screen.getByTestId('documents-error')).toHaveAttribute('role', 'alert');
  });

  it('renders one list item per document once loaded', async () => {
    const profileId = await seedProfile();
    await seedPdf(profileId, 'alpha.pdf');
    await seedPdf(profileId, 'beta.pdf');

    render(
      <MemoryRouter>
        <DocumentList />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('documents-list')).toBeInTheDocument());
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('alpha.pdf')).toBeInTheDocument();
    expect(screen.getByText('beta.pdf')).toBeInTheDocument();
  });
});
