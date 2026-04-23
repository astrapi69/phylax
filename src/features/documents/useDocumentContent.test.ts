import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, waitFor, act } from '@testing-library/react';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { ProfileRepository, DocumentRepository } from '../../db/repositories';
import { useDocumentContent } from './useDocumentContent';

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

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
  if (typeof URL.createObjectURL !== 'function') {
    let counter = 0;
    URL.createObjectURL = vi.fn(() => `blob:mock-${++counter}`);
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    URL.revokeObjectURL = vi.fn();
  }
});

describe('useDocumentContent', () => {
  it('loads metadata + blob and exposes a blob: URL in the ready state', async () => {
    const profileId = await seedProfile();
    const id = await seedDocument(
      profileId,
      'a.pdf',
      'application/pdf',
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    );

    const { result } = renderHook(() => useDocumentContent(id));
    expect(result.current.kind).toBe('loading');

    await waitFor(() => expect(result.current.kind).toBe('ready'));
    if (result.current.kind !== 'ready') throw new Error('unreachable');
    expect(result.current.url).toMatch(/^blob:/);
    expect(result.current.document.filename).toBe('a.pdf');
    expect(result.current.document.mimeType).toBe('application/pdf');
  });

  it('returns not-found for an unknown id', async () => {
    await seedProfile();

    const { result } = renderHook(() => useDocumentContent('missing-id'));

    await waitFor(() => expect(result.current.kind).toBe('not-found'));
  });

  it('returns not-found when the blob row is missing (orphaned metadata)', async () => {
    const profileId = await seedProfile();
    const id = await seedDocument(
      profileId,
      'orphan.pdf',
      'application/pdf',
      new Uint8Array([0x25]),
    );
    // Remove only the blob row; metadata stays.
    const { db } = await import('../../db/schema');
    await db.documentBlobs.delete(id);

    const { result } = renderHook(() => useDocumentContent(id));

    await waitFor(() => expect(result.current.kind).toBe('not-found'));
  });

  it('returns decrypt-failed when the blob row is corrupted', async () => {
    const profileId = await seedProfile();
    const id = await seedDocument(
      profileId,
      'bad.pdf',
      'application/pdf',
      new Uint8Array([0x25, 0x50]),
    );
    const { db } = await import('../../db/schema');
    await db.documentBlobs.put({ id, payload: new ArrayBuffer(8) });

    const { result } = renderHook(() => useDocumentContent(id));

    await waitFor(() => expect(result.current.kind).toBe('decrypt-failed'));
  });

  it('revokes the previous URL when id changes and creates a new one', async () => {
    const profileId = await seedProfile();
    const firstId = await seedDocument(
      profileId,
      'one.pdf',
      'application/pdf',
      new Uint8Array([0x25, 0x50]),
    );
    const secondId = await seedDocument(
      profileId,
      'two.pdf',
      'application/pdf',
      new Uint8Array([0x25, 0x50, 0x44]),
    );

    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    const { result, rerender } = renderHook(({ id }: { id: string }) => useDocumentContent(id), {
      initialProps: { id: firstId },
    });

    await waitFor(() => expect(result.current.kind).toBe('ready'));
    if (result.current.kind !== 'ready') throw new Error('unreachable');
    const firstUrl = result.current.url;

    await act(async () => {
      rerender({ id: secondId });
    });

    await waitFor(() => {
      if (result.current.kind !== 'ready') return;
      expect(result.current.document.filename).toBe('two.pdf');
    });

    expect(revokeSpy).toHaveBeenCalledWith(firstUrl);
    revokeSpy.mockRestore();
  });

  it('revokes the object URL on unmount', async () => {
    const profileId = await seedProfile();
    const id = await seedDocument(profileId, 'a.pdf', 'application/pdf', new Uint8Array([0x25]));

    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    const { result, unmount } = renderHook(() => useDocumentContent(id));

    await waitFor(() => expect(result.current.kind).toBe('ready'));
    if (result.current.kind !== 'ready') throw new Error('unreachable');
    const url = result.current.url;

    unmount();

    expect(revokeSpy).toHaveBeenCalledWith(url);
    revokeSpy.mockRestore();
  });
});
