import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../i18n/config';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { ProfileRepository, DocumentRepository } from '../../db/repositories';
import type { Document } from '../../domain';
import { DocumentRowDeleteAction } from './DocumentRowDeleteAction';

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

async function seedDocument(
  profileId: string,
  filename: string,
  mimeType: string,
  extra: Partial<Document> = {},
): Promise<Document> {
  const repo = new DocumentRepository();
  return await repo.create({
    profileId,
    filename,
    mimeType,
    sizeBytes: 4,
    content: new Uint8Array([0, 1, 2, 3]).buffer as ArrayBuffer,
    ...extra,
  });
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
  if (i18n.language !== 'de') {
    void i18n.changeLanguage('de');
  }
});

describe('DocumentRowDeleteAction', () => {
  it('renders an icon button with an aria-label naming the filename', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'meinbericht.pdf', 'application/pdf');

    render(
      <MemoryRouter>
        <DocumentRowDeleteAction document={doc} onDeleted={vi.fn()} />
      </MemoryRouter>,
    );

    const btn = screen.getByTestId(`document-row-delete-${doc.id}`);
    expect(btn).toBeInTheDocument();
    expect(btn.getAttribute('aria-label')).toMatch(/meinbericht\.pdf/);
  });

  it('opens the confirmation dialog on click', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'note.pdf', 'application/pdf');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DocumentRowDeleteAction document={doc} onDeleted={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId(`document-row-delete-${doc.id}`));

    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
    expect(screen.getByTestId(`document-row-delete-message-${doc.id}`)).toHaveTextContent(
      /note\.pdf/,
    );
  });

  it('cancel closes the dialog without calling onDeleted', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'cancel.pdf', 'application/pdf');
    const onDeleted = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DocumentRowDeleteAction document={doc} onDeleted={onDeleted} />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId(`document-row-delete-${doc.id}`));
    await waitFor(() => screen.getByRole("alertdialog"));
    await user.click(screen.getByRole('button', { name: /Abbrechen/i }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('confirm deletes the document and fires onDeleted', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'doomed.pdf', 'application/pdf');
    const onDeleted = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DocumentRowDeleteAction document={doc} onDeleted={onDeleted} />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId(`document-row-delete-${doc.id}`));
    await waitFor(() => screen.getByRole("alertdialog"));
    await user.click(screen.getByRole('button', { name: /Löschen bestätigen/i }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    // Dialog closes after success.
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    // Document gone from DB.
    const repo = new DocumentRepository();
    expect(await repo.getById(doc.id)).toBeNull();
  });

  it('surfaces the linked-warning when the document is linked to an observation', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'linked.pdf', 'application/pdf', {
      linkedObservationId: 'some-obs-id',
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DocumentRowDeleteAction document={doc} onDeleted={vi.fn()} />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId(`document-row-delete-${doc.id}`));
    await waitFor(() => screen.getByRole("alertdialog"));
    expect(screen.getByTestId(`document-row-delete-linked-${doc.id}`)).toBeInTheDocument();
  });
});
