import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { deriveKeyFromPassword, unlockWithKey, lock, getLockState } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { ProfileRepository, ObservationRepository } from '../../db/repositories';
import { __resetAutoLockPauseStateForTests, isAutoLockPaused } from '../auto-lock/pauseStore';
import { useChangeMasterPassword } from './useChangeMasterPassword';

const OLD = 'current-password-12';
const NEW = 'next-password-345';

async function unlockWith(password: string): Promise<void> {
  const meta = await readMeta();
  if (!meta) throw new Error('meta missing in fixture');
  const key = await deriveKeyFromPassword(password, new Uint8Array(meta.salt));
  if (getLockState() === 'unlocked') lock();
  unlockWithKey(key);
}

beforeEach(async () => {
  __resetAutoLockPauseStateForTests();
  await setupCompletedOnboarding(OLD);
  await unlockWith(OLD);
  const profileRepo = new ProfileRepository();
  const p = await profileRepo.create({
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
  const obsRepo = new ObservationRepository();
  await obsRepo.create({
    profileId: p.id,
    theme: 'X',
    fact: 'x',
    pattern: 'x',
    selfRegulation: 'x',
    status: 'x',
    source: 'user',
    extraSections: {},
  });
});

describe('useChangeMasterPassword', () => {
  it('happy path: idle -> verifying -> reencrypting -> done', async () => {
    const { result } = renderHook(() => useChangeMasterPassword());
    expect(result.current.status.kind).toBe('idle');

    await act(async () => {
      await result.current.changePassword({
        currentPassword: OLD,
        newPassword: NEW,
        confirmPassword: NEW,
      });
    });

    await waitFor(() => expect(result.current.status.kind).toBe('done'));

    // After done: lock + unlock with NEW works.
    lock();
    await unlockWith(NEW);
    const obsRepo = new ObservationRepository();
    const profiles = await new ProfileRepository().list();
    const profile = profiles[0];
    if (!profile) throw new Error('profile missing after re-encrypt');
    const observations = await obsRepo.listByProfile(profile.id);
    expect(observations).toHaveLength(1);
  });

  it('wrong current password yields wrong-current error', async () => {
    const { result } = renderHook(() => useChangeMasterPassword());
    await act(async () => {
      await result.current.changePassword({
        currentPassword: 'this-is-not-my-password',
        newPassword: NEW,
        confirmPassword: NEW,
      });
    });
    expect(result.current.status.kind).toBe('error');
    if (result.current.status.kind === 'error') {
      expect(result.current.status.error.kind).toBe('wrong-current');
    }
  });

  it('mismatched new + confirm yields mismatch error', async () => {
    const { result } = renderHook(() => useChangeMasterPassword());
    await act(async () => {
      await result.current.changePassword({
        currentPassword: OLD,
        newPassword: NEW,
        confirmPassword: 'different-password-99',
      });
    });
    expect(result.current.status.kind).toBe('error');
    if (result.current.status.kind === 'error') {
      expect(result.current.status.error.kind).toBe('mismatch');
    }
  });

  it('new password too short yields weak-new error', async () => {
    const { result } = renderHook(() => useChangeMasterPassword());
    await act(async () => {
      await result.current.changePassword({
        currentPassword: OLD,
        newPassword: 'short',
        confirmPassword: 'short',
      });
    });
    expect(result.current.status.kind).toBe('error');
    if (result.current.status.kind === 'error' && result.current.status.error.kind === 'weak-new') {
      expect(result.current.status.error.reason).toBe('too-short');
    }
  });

  it('new password identical to current yields same-as-current error', async () => {
    const { result } = renderHook(() => useChangeMasterPassword());
    await act(async () => {
      await result.current.changePassword({
        currentPassword: OLD,
        newPassword: OLD,
        confirmPassword: OLD,
      });
    });
    expect(result.current.status.kind).toBe('error');
    if (result.current.status.kind === 'error') {
      expect(result.current.status.error.kind).toBe('same-as-current');
    }
  });

  it('rejects when keyStore is locked', async () => {
    lock();
    const { result } = renderHook(() => useChangeMasterPassword());
    await act(async () => {
      await result.current.changePassword({
        currentPassword: OLD,
        newPassword: NEW,
        confirmPassword: NEW,
      });
    });
    expect(result.current.status.kind).toBe('error');
    if (result.current.status.kind === 'error') {
      expect(result.current.status.error.kind).toBe('locked');
    }
  });

  it('pauses auto-lock during the operation and releases on success', async () => {
    expect(isAutoLockPaused()).toBe(false);
    const { result } = renderHook(() => useChangeMasterPassword());
    await act(async () => {
      await result.current.changePassword({
        currentPassword: OLD,
        newPassword: NEW,
        confirmPassword: NEW,
      });
    });
    expect(isAutoLockPaused()).toBe(false);
    expect(result.current.status.kind).toBe('done');
  });

  it('reset returns to idle', async () => {
    const { result } = renderHook(() => useChangeMasterPassword());
    await act(async () => {
      await result.current.changePassword({
        currentPassword: 'wrong',
        newPassword: NEW,
        confirmPassword: NEW,
      });
    });
    expect(result.current.status.kind).toBe('error');
    act(() => {
      result.current.reset();
    });
    expect(result.current.status.kind).toBe('idle');
  });
});
