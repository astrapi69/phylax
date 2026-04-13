import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { lock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { ProfileRepository } from '../../db/repositories/profileRepository';
import { useProfileCreate } from './useProfileCreate';

const TEST_PASSWORD = 'test-password-12';
const onComplete = vi.fn();

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const { readMeta } = await import('../../db/meta');
  const { unlock } = await import('../../crypto');
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
  onComplete.mockReset();
});

describe('useProfileCreate', () => {
  it('initial state is idle with default version', () => {
    const { result } = renderHook(() => useProfileCreate(onComplete));
    expect(result.current.state.kind).toBe('idle');
    expect(result.current.name).toBe('');
    expect(result.current.profileType).toBe('self');
    expect(result.current.managedBy).toBe('');
    expect(result.current.version).toBe('1.0');
  });

  it('isValid is false when name is empty', () => {
    const { result } = renderHook(() => useProfileCreate(onComplete));
    expect(result.current.isValid).toBe(false);
  });

  it('isValid is true when name is set and profileType is self', () => {
    const { result } = renderHook(() => useProfileCreate(onComplete));
    act(() => result.current.setName('Mein Profil'));
    expect(result.current.isValid).toBe(true);
  });

  it('isValid is false when profileType is proxy and managedBy is empty', () => {
    const { result } = renderHook(() => useProfileCreate(onComplete));
    act(() => {
      result.current.setName('Mutters Profil');
      result.current.setProfileType('proxy');
    });
    expect(result.current.isValid).toBe(false);
  });

  it('isValid is true when profileType is proxy and managedBy is set', () => {
    const { result } = renderHook(() => useProfileCreate(onComplete));
    act(() => {
      result.current.setName('Mutters Profil');
      result.current.setProfileType('proxy');
      result.current.setManagedBy('Asterios');
    });
    expect(result.current.isValid).toBe(true);
  });

  it('submit transitions to done', async () => {
    const { result } = renderHook(() => useProfileCreate(onComplete));
    act(() => result.current.setName('Test Profil'));

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.state.kind).toBe('done');
    expect(onComplete).toHaveBeenCalledOnce();
    lock();
  });

  it('submit creates a profile via ProfileRepository', async () => {
    const { result } = renderHook(() => useProfileCreate(onComplete));
    act(() => result.current.setName('Test Profil'));

    await act(async () => {
      await result.current.submit();
    });

    const repo = new ProfileRepository();
    const profile = await repo.getCurrentProfile();
    expect(profile).not.toBeNull();
    expect(profile?.version).toBe('1.0');
    lock();
  });

  it('submit with proxy stores managedBy', async () => {
    const { result } = renderHook(() => useProfileCreate(onComplete));
    act(() => {
      result.current.setName('Mutters Profil');
      result.current.setProfileType('proxy');
      result.current.setManagedBy('Asterios');
    });

    await act(async () => {
      await result.current.submit();
    });

    const repo = new ProfileRepository();
    const profile = await repo.getCurrentProfile();
    expect(profile?.baseData.profileType).toBe('proxy');
    expect(profile?.baseData.managedBy).toBe('Asterios');
    lock();
  });

  it('submit with self leaves managedBy undefined', async () => {
    const { result } = renderHook(() => useProfileCreate(onComplete));
    act(() => result.current.setName('Mein Profil'));

    await act(async () => {
      await result.current.submit();
    });

    const repo = new ProfileRepository();
    const profile = await repo.getCurrentProfile();
    expect(profile?.baseData.profileType).toBe('self');
    expect(profile?.baseData.managedBy).toBeUndefined();
    lock();
  });

  it('submit does nothing when invalid', async () => {
    const { result } = renderHook(() => useProfileCreate(onComplete));
    // Name is empty, so isValid is false

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.state.kind).toBe('idle');
    expect(onComplete).not.toHaveBeenCalled();
    lock();
  });
});
