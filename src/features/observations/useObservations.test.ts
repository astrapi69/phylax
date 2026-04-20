import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { ObservationRepository, ProfileRepository } from '../../db/repositories';
import type { Profile } from '../../domain';
import { useObservations } from './useObservations';

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

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
});

describe('useObservations', () => {
  it('initial state is loading', () => {
    const { result } = renderHook(() => useObservations());
    expect(result.current.state.kind).toBe('loading');
  });

  it('loads grouped observations on mount', async () => {
    const profile = await createProfile();
    const obsRepo = new ObservationRepository();
    await obsRepo.create({
      profileId: profile.id,
      theme: 'Schulter',
      fact: 'a',
      pattern: '',
      selfRegulation: '',
      status: 'stabil',
      source: 'user',
      extraSections: {},
    });
    await obsRepo.create({
      profileId: profile.id,
      theme: 'Knie',
      fact: 'b',
      pattern: '',
      selfRegulation: '',
      status: 'akut',
      source: 'user',
      extraSections: {},
    });

    const { result } = renderHook(() => useObservations());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      expect(result.current.state.groups.map((g) => g.theme)).toEqual(['Knie', 'Schulter']);
      expect(result.current.state.groups[0]?.observations).toHaveLength(1);
    }
  });

  it('groups multiple observations under the same theme', async () => {
    const profile = await createProfile();
    const obsRepo = new ObservationRepository();
    for (let i = 0; i < 3; i++) {
      await obsRepo.create({
        profileId: profile.id,
        theme: 'Schulter',
        fact: `fact-${i}`,
        pattern: '',
        selfRegulation: '',
        status: 's',
        source: 'user',
        extraSections: {},
      });
    }
    const { result } = renderHook(() => useObservations());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      expect(result.current.state.groups).toHaveLength(1);
      expect(result.current.state.groups[0]?.observations).toHaveLength(3);
    }
  });

  it('sorts themes using German-locale collation (Umlauts)', async () => {
    const profile = await createProfile();
    const obsRepo = new ObservationRepository();
    for (const theme of ['Zahn', 'Ärger', 'Blutdruck']) {
      await obsRepo.create({
        profileId: profile.id,
        theme,
        fact: '',
        pattern: '',
        selfRegulation: '',
        status: '',
        source: 'user',
        extraSections: {},
      });
    }
    const { result } = renderHook(() => useObservations());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      const themes = result.current.state.groups.map((g) => g.theme);
      expect(themes.indexOf('Ärger')).toBeLessThan(themes.indexOf('Zahn'));
      expect(themes.indexOf('Blutdruck')).toBeLessThan(themes.indexOf('Zahn'));
    }
  });

  it('returns empty groups when the profile has no observations', async () => {
    await createProfile();
    const { result } = renderHook(() => useObservations());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      expect(result.current.state.groups).toEqual([]);
    }
  });

  it('transitions to error when no profile exists', async () => {
    const { result } = renderHook(() => useObservations());
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    if (result.current.state.kind === 'error') {
      expect(result.current.state.error.kind).toBe('no-profile');
    }
  });

  it('transitions to error when the repository throws', async () => {
    await createProfile();
    const spy = vi
      .spyOn(ObservationRepository.prototype, 'listByProfile')
      .mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useObservations());
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    if (result.current.state.kind === 'error' && result.current.state.error.kind === 'generic') {
      expect(result.current.state.error.detail).toBe('boom');
    } else {
      throw new Error('expected generic error');
    }
    spy.mockRestore();
  });
});
