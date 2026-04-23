import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../i18n/config';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { ProfileRepository, DocumentRepository } from '../../db/repositories';
import { AttachedDocumentsForObservation } from './AttachedDocumentsList';

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

async function seedDocumentLinkedToObservation(
  profileId: string,
  filename: string,
  observationId: string,
): Promise<string> {
  const repo = new DocumentRepository();
  const d = await repo.create({
    profileId,
    filename,
    mimeType: 'application/pdf',
    sizeBytes: 4,
    content: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer,
  });
  await repo.linkToObservation(d.id, observationId);
  return d.id;
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
  if (i18n.language !== 'de') {
    void i18n.changeLanguage('de');
  }
});

describe('AttachedDocumentsForObservation', () => {
  it('renders nothing when no documents are linked to the observation', async () => {
    await seedProfile();

    const { container } = render(
      <MemoryRouter>
        <AttachedDocumentsForObservation observationId="obs-empty" />
      </MemoryRouter>,
    );

    // Allow the load effect to settle without rendering anything.
    await new Promise((r) => setTimeout(r, 50));
    expect(container.firstChild).toBeNull();
  });

  it('renders a heading + linked filenames when documents are attached', async () => {
    const profileId = await seedProfile();
    await seedDocumentLinkedToObservation(profileId, 'scan-1.pdf', 'obs-target');
    await seedDocumentLinkedToObservation(profileId, 'scan-2.pdf', 'obs-target');

    render(
      <MemoryRouter>
        <AttachedDocumentsForObservation observationId="obs-target" />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('attached-docs-observation-obs-target')).toBeInTheDocument(),
    );
    expect(screen.getByText('scan-1.pdf')).toBeInTheDocument();
    expect(screen.getByText('scan-2.pdf')).toBeInTheDocument();
    // Heading renders as "Angehängte Dokumente" in German locale.
    expect(screen.getByRole('heading', { level: 3 }).textContent).toMatch(/Angehängte Dokumente/);
    // Each filename links into the viewer route.
    const firstLink = screen.getByText('scan-1.pdf').closest('a');
    expect(firstLink).toHaveAttribute('href', expect.stringMatching(/^\/documents\//));
  });

  it('does not render documents linked to a different observation', async () => {
    const profileId = await seedProfile();
    await seedDocumentLinkedToObservation(profileId, 'other.pdf', 'obs-other');

    render(
      <MemoryRouter>
        <AttachedDocumentsForObservation observationId="obs-target" />
      </MemoryRouter>,
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('other.pdf')).not.toBeInTheDocument();
  });
});
