import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { OpenPointRepository, ProfileRepository } from '../../db/repositories';
import type { Profile } from '../../domain';
import { useOpenPoints } from './useOpenPoints';

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

async function seedPoint(
  profileId: string,
  text: string,
  context: string,
  resolved = false,
): Promise<void> {
  const repo = new OpenPointRepository();
  await repo.create({ profileId, text, context, resolved });
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
});

describe('useOpenPoints', () => {
  it('initial state is loading', () => {
    const { result } = renderHook(() => useOpenPoints());
    expect(result.current.state.kind).toBe('loading');
  });

  it('loads open points grouped by context', async () => {
    const profile = await createProfile();
    await seedPoint(profile.id, 'MRT besprechen', 'Beim naechsten Arztbesuch');
    await seedPoint(profile.id, 'Labor wiederholen', 'Wiederholungs-Blutabnahme');
    await seedPoint(profile.id, 'Termin vereinbaren', 'Beim naechsten Arztbesuch');

    const { result } = renderHook(() => useOpenPoints());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      expect(result.current.state.groups).toHaveLength(2);
      const arztbesuch = result.current.state.groups.find(
        (g) => g.context === 'Beim naechsten Arztbesuch',
      );
      expect(arztbesuch?.items).toHaveLength(2);
    }
  });

  it('returns empty groups array when no points exist', async () => {
    await createProfile();
    const { result } = renderHook(() => useOpenPoints());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      expect(result.current.state.groups).toEqual([]);
    }
  });

  it('transitions to error when no profile exists', async () => {
    const { result } = renderHook(() => useOpenPoints());
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    if (result.current.state.kind === 'error') {
      expect(result.current.state.error.kind).toBe('no-profile');
    }
  });

  it('sorts contexts with German-locale collation (Umlauts)', async () => {
    const profile = await createProfile();
    for (const ctx of ['Zahnarzt', 'Ärger', 'Blutabnahme']) {
      await seedPoint(profile.id, `text-${ctx}`, ctx);
    }

    const { result } = renderHook(() => useOpenPoints());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      const contexts = result.current.state.groups.map((g) => g.context);
      expect(contexts.indexOf('Ärger')).toBeLessThan(contexts.indexOf('Zahnarzt'));
      expect(contexts.indexOf('Blutabnahme')).toBeLessThan(contexts.indexOf('Zahnarzt'));
    }
  });

  it('orders unresolved items before resolved within a group', async () => {
    const profile = await createProfile();
    const ctx = 'Beim naechsten Arztbesuch';
    // Seed a resolved item FIRST, then an unresolved one. Expected
    // display order: unresolved first.
    await seedPoint(profile.id, 'erledigt', ctx, true);
    await seedPoint(profile.id, 'offen', ctx, false);

    const { result } = renderHook(() => useOpenPoints());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      const group = result.current.state.groups[0];
      expect(group?.items[0]?.text).toBe('offen');
      expect(group?.items[1]?.text).toBe('erledigt');
    }
  });

  it('transitions to error when the repository throws', async () => {
    await createProfile();
    const spy = vi
      .spyOn(OpenPointRepository.prototype, 'listByProfile')
      .mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useOpenPoints());
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    if (result.current.state.kind === 'error' && result.current.state.error.kind === 'generic') {
      expect(result.current.state.error.detail).toBe('boom');
    } else {
      throw new Error('expected generic error');
    }
    spy.mockRestore();
  });
});
