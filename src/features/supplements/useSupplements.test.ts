import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { ProfileRepository, SupplementRepository } from '../../db/repositories';
import type { Profile, SupplementCategory } from '../../domain';
import { useSupplements } from './useSupplements';

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

async function seedSupplement(
  profileId: string,
  name: string,
  category: SupplementCategory,
): Promise<void> {
  const repo = new SupplementRepository();
  await repo.create({ profileId, name, category });
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
});

describe('useSupplements', () => {
  it('initial state is loading', () => {
    const { result } = renderHook(() => useSupplements());
    expect(result.current.state.kind).toBe('loading');
  });

  it('loads supplements grouped by category', async () => {
    const profile = await createProfile();
    await seedSupplement(profile.id, 'Vitamin D', 'daily');
    await seedSupplement(profile.id, 'Omega 3', 'daily');
    await seedSupplement(profile.id, 'Kreatin', 'paused');

    const { result } = renderHook(() => useSupplements());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      const daily = result.current.state.groups.find((g) => g.category === 'daily');
      const paused = result.current.state.groups.find((g) => g.category === 'paused');
      expect(daily?.supplements).toHaveLength(2);
      expect(paused?.supplements).toHaveLength(1);
    }
  });

  it('returns empty groups array when no supplements exist', async () => {
    await createProfile();
    const { result } = renderHook(() => useSupplements());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      expect(result.current.state.groups).toEqual([]);
    }
  });

  it('transitions to error when no profile exists', async () => {
    const { result } = renderHook(() => useSupplements());
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    if (result.current.state.kind === 'error') {
      expect(result.current.state.error.kind).toBe('no-profile');
    }
  });

  it('orders groups: daily, regular, on-demand, paused', async () => {
    const profile = await createProfile();
    // Seed in reverse of expected display order
    await seedSupplement(profile.id, 'P', 'paused');
    await seedSupplement(profile.id, 'O', 'on-demand');
    await seedSupplement(profile.id, 'R', 'regular');
    await seedSupplement(profile.id, 'D', 'daily');

    const { result } = renderHook(() => useSupplements());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      const categories = result.current.state.groups.map((g) => g.category);
      expect(categories).toEqual(['daily', 'regular', 'on-demand', 'paused']);
    }
  });

  it('excludes empty categories from groups', async () => {
    const profile = await createProfile();
    // Only daily and on-demand, skip regular and paused
    await seedSupplement(profile.id, 'D', 'daily');
    await seedSupplement(profile.id, 'O', 'on-demand');

    const { result } = renderHook(() => useSupplements());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      const categories = result.current.state.groups.map((g) => g.category);
      expect(categories).toEqual(['daily', 'on-demand']);
      expect(categories).not.toContain('regular');
      expect(categories).not.toContain('paused');
    }
  });

  it('transitions to error when the repository throws', async () => {
    await createProfile();
    const spy = vi
      .spyOn(SupplementRepository.prototype, 'listByProfile')
      .mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useSupplements());
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    if (result.current.state.kind === 'error' && result.current.state.error.kind === 'generic') {
      expect(result.current.state.error.detail).toBe('boom');
    } else {
      throw new Error('expected generic error');
    }
    spy.mockRestore();
  });
});
