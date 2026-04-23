import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../../i18n/config';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { ProfileRepository, DocumentRepository } from '../../db/repositories';
import type { Document } from '../../domain';
import { DocumentListItem } from './DocumentListItem';

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
): Promise<Document> {
  const repo = new DocumentRepository();
  return await repo.create({
    profileId,
    filename,
    mimeType,
    sizeBytes: bytes.byteLength,
    content: bytes.buffer.slice(0) as ArrayBuffer,
  });
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
  if (i18n.language !== 'de') {
    void i18n.changeLanguage('de');
  }
  if (typeof URL.createObjectURL !== 'function') {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    URL.revokeObjectURL = vi.fn();
  }
});

describe('DocumentListItem', () => {
  it('renders filename and size/date metadata for a PDF', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(
      profileId,
      'report.pdf',
      'application/pdf',
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    );

    render(
      <MemoryRouter>
        <ul>
          <DocumentListItem document={doc} />
        </ul>
      </MemoryRouter>,
    );

    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByTestId(`document-item-${doc.id}`)).toBeInTheDocument();
    // PDF has no thumbnail img; metadata line contains the byte-count label.
    expect(screen.queryByTestId('thumbnail')).not.toBeInTheDocument();
    expect(screen.getByText(/4 B/)).toBeInTheDocument();
  });

  it('loads and renders a thumbnail image for image/* documents', async () => {
    const profileId = await seedProfile();
    // Minimal PNG header bytes; the actual decode does not happen in
    // jsdom, we just need an image/* MIME and a decryptable blob.
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const doc = await seedDocument(profileId, 'scan.png', 'image/png', png);

    render(
      <MemoryRouter>
        <ul>
          <DocumentListItem document={doc} />
        </ul>
      </MemoryRouter>,
    );

    const thumb = await waitFor(() => screen.getByTestId('thumbnail'));
    expect(thumb.tagName).toBe('IMG');
    expect(thumb).toHaveAttribute('src');
    expect(thumb.getAttribute('src')).toMatch(/^blob:/);
    // Decorative image: alt is empty per WCAG best practice.
    expect(thumb).toHaveAttribute('alt', '');
  });

  it('wraps the row in a link to /documents/:id', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(
      profileId,
      'linked.pdf',
      'application/pdf',
      new Uint8Array([0x25, 0x50]),
    );

    render(
      <MemoryRouter>
        <ul>
          <DocumentListItem document={doc} />
        </ul>
      </MemoryRouter>,
    );

    const link = screen.getByTestId(`document-item-link-${doc.id}`);
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', `/documents/${doc.id}`);
  });

  it('falls back to the generic file icon when the blob decrypt fails', async () => {
    const profileId = await seedProfile();
    const png = new Uint8Array([0x89, 0x50]);
    const doc = await seedDocument(profileId, 'broken.png', 'image/png', png);

    // Corrupt the blob row to force decrypt failure on the item's fetch.
    const { db } = await import('../../db/schema');
    await db.documentBlobs.put({ id: doc.id, payload: new ArrayBuffer(4) });

    render(
      <MemoryRouter>
        <ul>
          <DocumentListItem document={doc} />
        </ul>
      </MemoryRouter>,
    );

    // No thumbnail rendered, metadata still shown.
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByTestId('thumbnail')).not.toBeInTheDocument();
    expect(screen.getByText('broken.png')).toBeInTheDocument();
  });
});
