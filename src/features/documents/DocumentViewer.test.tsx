import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import i18n from '../../i18n/config';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { ProfileRepository, DocumentRepository } from '../../db/repositories';
import { DocumentViewer } from './DocumentViewer';

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
  bytes: Uint8Array,
): Promise<string> {
  const repo = new DocumentRepository();
  const doc = await repo.create({
    profileId,
    filename,
    mimeType,
    sizeBytes: bytes.byteLength,
    content: bytes.buffer.slice(0) as ArrayBuffer,
  });
  return doc.id;
}

function renderAtPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/documents/:id" element={<DocumentViewer />} />
        <Route path="/documents" element={<div data-testid="documents-list-route" />} />
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
  if (typeof URL.createObjectURL !== 'function') {
    let counter = 0;
    URL.createObjectURL = vi.fn(() => `blob:mock-${++counter}`);
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    URL.revokeObjectURL = vi.fn();
  }
});

describe('DocumentViewer', () => {
  it('renders an iframe with a blob: src and the filename as title for a PDF', async () => {
    const profileId = await seedProfile();
    const id = await seedDocument(
      profileId,
      'report.pdf',
      'application/pdf',
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    );

    renderAtPath(`/documents/${id}`);

    const iframe = await waitFor(() => screen.getByTestId('pdf-viewer-iframe'));
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe.getAttribute('src')).toMatch(/^blob:/);
    expect(iframe).toHaveAttribute('title', 'report.pdf');
    expect(screen.getByTestId('viewer-title')).toHaveTextContent('report.pdf');
  });

  it('sandboxes the PDF iframe with only allow-scripts (no allow-same-origin)', async () => {
    const profileId = await seedProfile();
    const id = await seedDocument(
      profileId,
      'sandboxed.pdf',
      'application/pdf',
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    );

    renderAtPath(`/documents/${id}`);

    const iframe = await waitFor(() => screen.getByTestId('pdf-viewer-iframe'));
    const sandbox = iframe.getAttribute('sandbox');
    expect(sandbox).toBe('allow-scripts');
    // Regression guard: never grant same-origin back to the viewer.
    // PDF JS under same-origin can reach the Phylax origin's
    // IndexedDB and in-memory state, which is the whole threat we
    // mitigate by sandboxing.
    expect(sandbox).not.toMatch(/allow-same-origin/);
  });

  it('surfaces the localized not-found error for an unknown id', async () => {
    await seedProfile();

    renderAtPath('/documents/does-not-exist');

    const err = await waitFor(() => screen.getByTestId('viewer-error'));
    expect(err).toHaveAttribute('role', 'alert');
    expect(err.textContent).toMatch(/nicht gefunden/i);
  });

  it('routes image/png to the ImageViewer (not the unsupported-type fallback)', async () => {
    const profileId = await seedProfile();
    const id = await seedDocument(
      profileId,
      'scan.png',
      'image/png',
      new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    );

    renderAtPath(`/documents/${id}`);

    const img = await waitFor(() => screen.getByTestId('image-viewer-img'));
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('alt', 'scan.png');
    expect(screen.queryByTestId('viewer-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pdf-viewer-iframe')).not.toBeInTheDocument();
  });

  it('renders unsupported-type fallback for non-whitelisted MIMEs (e.g. image/svg+xml)', async () => {
    const profileId = await seedProfile();
    // image/svg+xml is deliberately excluded from IMAGE_MIME_TYPES to
    // prevent executable-SVG from ever entering the image viewer path.
    const id = await seedDocument(
      profileId,
      'diagram.svg',
      'image/svg+xml',
      new Uint8Array([0x3c, 0x73, 0x76, 0x67]),
    );

    renderAtPath(`/documents/${id}`);

    const err = await waitFor(() => screen.getByTestId('viewer-error'));
    expect(err.textContent).toMatch(/svg/);
    expect(screen.queryByTestId('image-viewer-img')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pdf-viewer-iframe')).not.toBeInTheDocument();
  });

  it('renders decrypt-failed when the blob ciphertext is tampered', async () => {
    const profileId = await seedProfile();
    const id = await seedDocument(profileId, 'bad.pdf', 'application/pdf', new Uint8Array([0x25]));
    const { db } = await import('../../db/schema');
    await db.documentBlobs.put({ id, payload: new ArrayBuffer(8) });

    renderAtPath(`/documents/${id}`);

    const err = await waitFor(() => screen.getByTestId('viewer-error'));
    expect(err.textContent).toMatch(/entschlüsselt/i);
  });

  it('renders a back link pointing to /documents', async () => {
    const profileId = await seedProfile();
    const id = await seedDocument(profileId, 'a.pdf', 'application/pdf', new Uint8Array([0x25]));

    renderAtPath(`/documents/${id}`);

    const back = await waitFor(() => screen.getByTestId('viewer-back-link'));
    expect(back.tagName).toBe('A');
    expect(back).toHaveAttribute('href', '/documents');
  });
});
