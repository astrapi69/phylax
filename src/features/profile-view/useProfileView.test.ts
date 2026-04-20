import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { ProfileRepository } from '../../db/repositories';
import { useProfileView } from './useProfileView';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession() {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
});

describe('useProfileView', () => {
  it('initial state is loading', () => {
    const { result } = renderHook(() => useProfileView());
    expect(result.current.state.kind).toBe('loading');
  });

  it('loads the current profile on mount', async () => {
    const repo = new ProfileRepository();
    const profile = await repo.create({
      baseData: {
        name: 'Asterios',
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

    const { result } = renderHook(() => useProfileView());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      expect(result.current.state.profile.id).toBe(profile.id);
      expect(result.current.state.profile.baseData.name).toBe('Asterios');
    }
  });

  it('transitions to error when no profile exists', async () => {
    const { result } = renderHook(() => useProfileView());
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    if (result.current.state.kind === 'error') {
      expect(result.current.state.error).toEqual({ kind: 'not-found' });
    }
  });

  it('transitions to error when repository throws', async () => {
    const spy = vi
      .spyOn(ProfileRepository.prototype, 'getCurrentProfile')
      .mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useProfileView());
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    if (result.current.state.kind === 'error') {
      expect(result.current.state.error).toMatchObject({ kind: 'generic', detail: 'boom' });
    }
    spy.mockRestore();
  });

  it('calls getCurrentProfile exactly once per mount', async () => {
    const repo = new ProfileRepository();
    await repo.create({
      baseData: {
        name: 'x',
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
    const spy = vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile');
    const { result, rerender } = renderHook(() => useProfileView());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    rerender();
    rerender();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
