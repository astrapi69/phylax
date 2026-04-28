import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { ObservationRepository, ProfileRepository } from '../../db/repositories';
import { useThemes } from './useThemes';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useThemes', () => {
  it('returns empty themes when no profile exists', async () => {
    const { result } = renderHook(() => useThemes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.themes).toEqual([]);
  });

  it('loads themes for the current profile sorted by German collation', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue({
      id: 'p1',
      profileId: 'p1',
      createdAt: 0,
      updatedAt: 0,
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
    vi.spyOn(ObservationRepository.prototype, 'listThemes').mockResolvedValue([
      'Schulter',
      'Ärger',
      'Knie',
    ]);

    const { result } = renderHook(() => useThemes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.themes).toEqual(['Ärger', 'Knie', 'Schulter']);
  });

  it('returns empty themes when listThemes throws', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockResolvedValue({
      id: 'p1',
      profileId: 'p1',
      createdAt: 0,
      updatedAt: 0,
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
    vi.spyOn(ObservationRepository.prototype, 'listThemes').mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useThemes());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.themes).toEqual([]);
  });
});
