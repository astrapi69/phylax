import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, waitFor } from '@testing-library/react';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding, resetDatabase } from '../../db/test-helpers';
import { ProfileRepository, DocumentRepository } from '../../db/repositories';
import { useDocuments } from './useDocuments';

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

async function seedDocument(profileId: string, filename: string): Promise<string> {
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
});

describe('useDocuments', () => {
  it('starts in loading state and transitions to loaded with an empty list when no documents exist', async () => {
    await seedProfile();

    const { result } = renderHook(() => useDocuments());
    expect(result.current.state.kind).toBe('loading');

    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind !== 'loaded') throw new Error('unreachable');
    expect(result.current.state.documents).toHaveLength(0);
  });

  it('returns all documents for the current profile sorted newest first', async () => {
    const profileId = await seedProfile();
    const firstId = await seedDocument(profileId, 'first.pdf');
    await new Promise((r) => setTimeout(r, 5));
    const secondId = await seedDocument(profileId, 'second.pdf');
    await new Promise((r) => setTimeout(r, 5));
    const thirdId = await seedDocument(profileId, 'third.pdf');

    const { result } = renderHook(() => useDocuments());

    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind !== 'loaded') throw new Error('unreachable');
    const ids = result.current.state.documents.map((d) => d.id);
    expect(ids).toEqual([thirdId, secondId, firstId]);
  });

  it('emits a no-profile error when no profile exists', async () => {
    await resetDatabase();
    await setupCompletedOnboarding(TEST_PASSWORD);
    await unlockCurrent();

    const { result } = renderHook(() => useDocuments());

    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    if (result.current.state.kind !== 'error') throw new Error('unreachable');
    expect(result.current.state.error.kind).toBe('no-profile');
  });

  it('refetches when versionKey changes', async () => {
    const profileId = await seedProfile();
    await seedDocument(profileId, 'initial.pdf');

    const { result, rerender } = renderHook(({ v }: { v: number }) => useDocuments(v), {
      initialProps: { v: 0 },
    });

    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind !== 'loaded') throw new Error('unreachable');
    expect(result.current.state.documents).toHaveLength(1);

    await seedDocument(profileId, 'added.pdf');
    rerender({ v: 1 });

    await waitFor(() => {
      if (result.current.state.kind !== 'loaded') return;
      expect(result.current.state.documents).toHaveLength(2);
    });
    if (result.current.state.kind !== 'loaded') throw new Error('unreachable');
    expect(result.current.state.documents.map((d) => d.filename)).toEqual([
      'added.pdf',
      'initial.pdf',
    ]);
  });
});
