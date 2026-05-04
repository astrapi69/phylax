import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, waitFor } from '@testing-library/react';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding, resetDatabase } from '../../db/test-helpers';
import { DocumentRepository, ProfileRepository } from '../../db/repositories';
import type { Document } from '../../domain';
import { useAttachedDocuments } from './useAttachedDocuments';

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

async function seedDoc(
  profileId: string,
  link: { observationId?: string; labValueId?: string },
): Promise<Document> {
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  return new DocumentRepository().create({
    profileId,
    filename: 'lab.pdf',
    mimeType: 'application/pdf',
    sizeBytes: bytes.byteLength,
    content: bytes.buffer,
    linkedObservationId: link.observationId,
    linkedLabValueId: link.labValueId,
  });
}

beforeEach(async () => {
  lock();
  await resetDatabase();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
});

describe('useAttachedDocuments', () => {
  it('returns empty docs when no current profile exists (lines 44-45)', async () => {
    // Skip seedProfile: no profile means getCurrentProfile() returns
    // undefined and the hook short-circuits to an empty result.
    const { result } = renderHook(() => useAttachedDocuments({ observationId: 'o-irrelevant' }));
    await waitFor(() => expect(result.current.kind).toBe('loaded'));
    if (result.current.kind === 'loaded') {
      expect(result.current.documents).toEqual([]);
    }
  });

  it('lists documents linked to the given observation (happy path)', async () => {
    const profileId = await seedProfile();
    await seedDoc(profileId, { observationId: 'obs-1' });
    await seedDoc(profileId, { observationId: 'obs-2' });

    const { result } = renderHook(() => useAttachedDocuments({ observationId: 'obs-1' }));
    await waitFor(() => expect(result.current.kind).toBe('loaded'));
    if (result.current.kind === 'loaded') {
      expect(result.current.documents).toHaveLength(1);
      expect(result.current.documents[0]?.linkedObservationId).toBe('obs-1');
    }
  });

  it('lists documents linked to the given lab value (lines 51-52)', async () => {
    const profileId = await seedProfile();
    await seedDoc(profileId, { labValueId: 'lv-1' });
    await seedDoc(profileId, { observationId: 'obs-x' });

    const { result } = renderHook(() => useAttachedDocuments({ labValueId: 'lv-1' }));
    await waitFor(() => expect(result.current.kind).toBe('loaded'));
    if (result.current.kind === 'loaded') {
      expect(result.current.documents).toHaveLength(1);
      expect(result.current.documents[0]?.linkedLabValueId).toBe('lv-1');
    }
  });

  it('returns empty docs when neither observationId nor labValueId is supplied (lines 53-54)', async () => {
    await seedProfile();
    const { result } = renderHook(() => useAttachedDocuments({}));
    await waitFor(() => expect(result.current.kind).toBe('loaded'));
    if (result.current.kind === 'loaded') {
      expect(result.current.documents).toEqual([]);
    }
  });

  it('sorts loaded documents by createdAt descending', async () => {
    const profileId = await seedProfile();
    const first = await seedDoc(profileId, { observationId: 'obs-1' });
    // Force a later createdAt by waiting one ms tick.
    await new Promise((r) => setTimeout(r, 2));
    const second = await seedDoc(profileId, { observationId: 'obs-1' });

    const { result } = renderHook(() => useAttachedDocuments({ observationId: 'obs-1' }));
    await waitFor(() => expect(result.current.kind).toBe('loaded'));
    if (result.current.kind === 'loaded') {
      const ids = result.current.documents.map((d) => d.id);
      // Newest first.
      expect(ids[0]).toBe(second.id);
      expect(ids[1]).toBe(first.id);
    }
  });
});
