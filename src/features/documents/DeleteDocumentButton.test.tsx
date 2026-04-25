import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import i18n from '../../i18n/config';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { ProfileRepository, DocumentRepository } from '../../db/repositories';
import type { Document } from '../../domain';
import { db } from '../../db/schema';
import { DeleteDocumentButton } from './DeleteDocumentButton';

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
  linked?: { kind: 'observation' | 'lab-value'; id: string },
): Promise<Document> {
  const repo = new DocumentRepository();
  const d = await repo.create({
    profileId,
    filename,
    mimeType: 'application/pdf',
    sizeBytes: 4,
    content: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer,
  });
  if (linked?.kind === 'observation') return repo.linkToObservation(d.id, linked.id);
  if (linked?.kind === 'lab-value') return repo.linkToLabValue(d.id, linked.id);
  return d;
}

function renderAt(doc: Document) {
  return render(
    <MemoryRouter initialEntries={[`/documents/${doc.id}`]}>
      <Routes>
        <Route path="/documents/:id" element={<DeleteDocumentButton document={doc} />} />
        <Route path="/documents" element={<div data-testid="list-route">list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
  if (i18n.language !== 'de') {
    void i18n.changeLanguage('de');
  }
});

describe('DeleteDocumentButton', () => {
  it('renders the idle "Delete document" button', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'scan.pdf');

    renderAt(doc);

    expect(screen.getByTestId('delete-document-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('delete-confirm-btn')).not.toBeInTheDocument();
  });

  it('clicking the button opens the confirmation with the filename verbatim', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'scan.pdf');

    renderAt(doc);

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-document-btn'));
    });

    const message = screen.getByTestId('delete-confirm-message');
    expect(message.textContent).toMatch(/scan\.pdf/);
    expect(screen.getByTestId('delete-confirm-btn')).toBeInTheDocument();
    expect(screen.getByTestId('delete-cancel-btn')).toBeInTheDocument();
  });

  it('moves focus to the Cancel button when transitioning to confirm state', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'a.pdf');

    renderAt(doc);

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-document-btn'));
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('delete-cancel-btn'));
    });
  });

  it('Cancel returns to idle without deleting', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'a.pdf');

    renderAt(doc);

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-document-btn'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-cancel-btn'));
    });

    expect(screen.getByTestId('delete-document-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('delete-confirm-btn')).not.toBeInTheDocument();

    // Document still exists.
    const readBack = await new DocumentRepository().getById(doc.id);
    expect(readBack).not.toBeNull();
  });

  it('Escape key in confirm state returns to idle', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'a.pdf');

    renderAt(doc);

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-document-btn'));
    });
    // O-20 migration: Modal listens at document level via the
    // shared primitive's keydown handler.
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(screen.getByTestId('delete-document-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('delete-confirm-btn')).not.toBeInTheDocument();
  });

  it('Confirm invokes the repository delete and navigates to /documents', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'a.pdf');

    renderAt(doc);

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-document-btn'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-confirm-btn'));
    });

    await waitFor(() => expect(screen.getByTestId('list-route')).toBeInTheDocument());

    // Both rows gone.
    expect(await db.documents.get(doc.id)).toBeUndefined();
    expect(await db.documentBlobs.get(doc.id)).toBeUndefined();
  });

  it('renders the linked-entity warning when the document is linked to an observation', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'a.pdf', {
      kind: 'observation',
      id: 'obs-1',
    });

    renderAt(doc);

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-document-btn'));
    });

    const warning = screen.getByTestId('delete-linked-warning');
    expect(warning.textContent).toMatch(/Beobachtung/);
  });

  it('renders the linked-entity warning for a lab-value link with the correct kind', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'a.pdf', {
      kind: 'lab-value',
      id: 'lv-1',
    });

    renderAt(doc);

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-document-btn'));
    });

    const warning = screen.getByTestId('delete-linked-warning');
    expect(warning.textContent).toMatch(/Laborwert/);
  });

  it('no linked-entity warning when the document is unlinked', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'a.pdf');

    renderAt(doc);

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-document-btn'));
    });

    expect(screen.queryByTestId('delete-linked-warning')).not.toBeInTheDocument();
  });

  it('silently deletes a document whose blob row is already missing (orphan state)', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'orphan.pdf');
    // Simulate upstream bug: blob row already gone.
    await db.documentBlobs.delete(doc.id);

    renderAt(doc);

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-document-btn'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-confirm-btn'));
    });

    await waitFor(() => expect(screen.getByTestId('list-route')).toBeInTheDocument());
    expect(screen.queryByTestId('delete-error')).not.toBeInTheDocument();
    expect(await db.documents.get(doc.id)).toBeUndefined();
  });

  it('surfaces a localized error message when delete throws, keeping confirm state', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'a.pdf');

    const spy = vi
      .spyOn(DocumentRepository.prototype, 'delete')
      .mockRejectedValueOnce(new Error('simulated-failure'));

    renderAt(doc);

    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-document-btn'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('delete-confirm-btn'));
    });

    await waitFor(() => expect(screen.getByTestId('delete-error')).toBeInTheDocument());
    expect(screen.getByTestId('delete-error').textContent).toMatch(/Löschen fehlgeschlagen/);
    // Stays on viewer, no navigation.
    expect(screen.queryByTestId('list-route')).not.toBeInTheDocument();

    spy.mockRestore();
  });
});
