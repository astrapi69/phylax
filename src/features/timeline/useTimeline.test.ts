import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { ProfileRepository, TimelineEntryRepository } from '../../db/repositories';
import type { Profile, TimelineEntry } from '../../domain';
import { useTimeline } from './useTimeline';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession() {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function createProfile(): Promise<Profile> {
  const repo = new ProfileRepository();
  return repo.create({
    baseData: {
      name: 'Test',
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

async function seedEntry(profileId: string, period: string, title: string): Promise<TimelineEntry> {
  const repo = new TimelineEntryRepository();
  return repo.create({
    profileId,
    period,
    title,
    content: `Content for ${title}`,
    source: 'user',
  });
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
});

describe('useTimeline', () => {
  it('initial state is loading', () => {
    const { result } = renderHook(() => useTimeline());
    expect(result.current.state.kind).toBe('loading');
  });

  it('loads entries in newest-first order (reverse of chronological)', async () => {
    const profile = await createProfile();
    // Insert oldest-first so chronological order matches insertion order
    await seedEntry(profile.id, 'Januar 2024', 'Erste Notiz');
    await new Promise((r) => setTimeout(r, 3));
    await seedEntry(profile.id, 'Juni 2025', 'Mittlere Notiz');
    await new Promise((r) => setTimeout(r, 3));
    await seedEntry(profile.id, 'Maerz 2026', 'Neueste Notiz');

    const { result } = renderHook(() => useTimeline());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      expect(result.current.state.entries[0]?.title).toBe('Neueste Notiz');
      expect(result.current.state.entries[2]?.title).toBe('Erste Notiz');
    }
  });

  it('returns empty array when no entries exist', async () => {
    await createProfile();
    const { result } = renderHook(() => useTimeline());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      expect(result.current.state.entries).toEqual([]);
    }
  });

  it('transitions to error when no profile exists', async () => {
    const { result } = renderHook(() => useTimeline());
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    if (result.current.state.kind === 'error') {
      expect(result.current.state.message).toMatch(/Kein Profil/);
    }
  });

  it('transitions to error when the repository throws', async () => {
    await createProfile();
    const spy = vi
      .spyOn(TimelineEntryRepository.prototype, 'listChronological')
      .mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useTimeline());
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    if (result.current.state.kind === 'error') {
      expect(result.current.state.message).toBe('boom');
    }
    spy.mockRestore();
  });
});
