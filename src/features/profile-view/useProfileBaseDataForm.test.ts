import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, act } from '@testing-library/react';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { ProfileRepository, ProfileVersionRepository } from '../../db/repositories';
import type { Profile } from '../../domain';
import { useProfileBaseDataForm } from './useProfileBaseDataForm';

const TEST_PASSWORD = 'test-password-12';

async function unlockCurrent(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function ensureProfile(overrides: Partial<Profile> = {}): Promise<Profile> {
  const repo = new ProfileRepository();
  return repo.create({
    baseData: {
      name: 'Anna',
      weightHistory: [],
      knownDiagnoses: ['Hypertonie'],
      currentMedications: ['Ramipril 5 mg'],
      relevantLimitations: [],
      profileType: 'self',
    },
    warningSigns: [],
    externalReferences: [],
    version: '1.3.1',
    ...overrides,
  });
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
});

describe('useProfileBaseDataForm', () => {
  it('starts in closed state', () => {
    const { result } = renderHook(() => useProfileBaseDataForm());
    expect(result.current.state.kind).toBe('closed');
  });

  it('openEdit prefills fields from profile', async () => {
    const profile = await ensureProfile({
      baseData: {
        name: 'Bea',
        birthDate: '1980-05-12',
        weightHistory: [],
        knownDiagnoses: ['Hypertonie', 'Asthma'],
        currentMedications: ['Ramipril'],
        relevantLimitations: ['Schulter'],
        profileType: 'self',
      },
    });

    const { result } = renderHook(() => useProfileBaseDataForm());
    act(() => {
      result.current.openEdit(profile);
    });

    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.fields.name).toBe('Bea');
    expect(result.current.state.fields.birthDate).toBe('1980-05-12');
    expect(result.current.state.fields.knownDiagnoses).toEqual(['Hypertonie', 'Asthma']);
    expect(result.current.state.fields.currentMedications).toEqual(['Ramipril']);
    expect(result.current.state.fields.relevantLimitations).toEqual(['Schulter']);
    expect(result.current.state.fields.lastUpdateReason).toBe('');
  });

  it('submit gated when name is empty', async () => {
    const profile = await ensureProfile();
    const { result } = renderHook(() => useProfileBaseDataForm());
    act(() => {
      result.current.openEdit(profile);
    });
    act(() => {
      result.current.setField('name', '   ');
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.state.kind).toBe('open');

    const stored = await new ProfileRepository().getById(profile.id);
    expect(stored?.baseData.name).toBe('Anna'); // unchanged
  });

  it('submit gated when birthDate is malformed', async () => {
    const profile = await ensureProfile();
    const { result } = renderHook(() => useProfileBaseDataForm());
    act(() => {
      result.current.openEdit(profile);
    });
    act(() => {
      result.current.setField('birthDate', '12.05.1980');
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.state.kind).toBe('open');
  });

  it('happy path: bumps version, creates ProfileVersion entry, persists baseData', async () => {
    const profile = await ensureProfile();
    let committed = false;
    const { result } = renderHook(() =>
      useProfileBaseDataForm({
        onCommitted: () => {
          committed = true;
        },
      }),
    );

    act(() => {
      result.current.openEdit(profile);
    });
    act(() => {
      result.current.setField('name', 'Anna Marie');
      result.current.setField('birthDate', '1980-05-12');
      result.current.setField('knownDiagnoses', ['Hypertonie', 'Allergie Pollen']);
      result.current.setField('lastUpdateReason', 'Allergie ergänzt');
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(committed).toBe(true);
    expect(result.current.state.kind).toBe('closed');

    const stored = await new ProfileRepository().getById(profile.id);
    expect(stored?.baseData.name).toBe('Anna Marie');
    expect(stored?.baseData.birthDate).toBe('1980-05-12');
    expect(stored?.baseData.knownDiagnoses).toEqual(['Hypertonie', 'Allergie Pollen']);
    expect(stored?.version).toBe('1.3.2'); // bumped
    expect(stored?.lastUpdateReason).toBe('Allergie ergänzt');

    const versions = await new ProfileVersionRepository().listByProfile(profile.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.version).toBe('1.3.2');
    expect(versions[0]?.changeDescription).toBe('Allergie ergänzt');
    expect(versions[0]?.changeDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('empty lastUpdateReason falls back to "Manuelle Bearbeitung"', async () => {
    const profile = await ensureProfile();
    const { result } = renderHook(() => useProfileBaseDataForm());
    act(() => {
      result.current.openEdit(profile);
    });
    act(() => {
      result.current.setField('name', 'Bea');
    });
    await act(async () => {
      await result.current.submit();
    });

    const stored = await new ProfileRepository().getById(profile.id);
    expect(stored?.lastUpdateReason).toBe('Manuelle Bearbeitung');
    const versions = await new ProfileVersionRepository().listByProfile(profile.id);
    expect(versions[0]?.changeDescription).toBe('Manuelle Bearbeitung');
  });

  it('Q4 migration: legacy age-only profile clears age when birthDate is set', async () => {
    const profile = await ensureProfile({
      baseData: {
        name: 'Carl',
        age: 47,
        birthDate: undefined,
        weightHistory: [],
        knownDiagnoses: [],
        currentMedications: [],
        relevantLimitations: [],
        profileType: 'self',
      },
    });

    const { result } = renderHook(() => useProfileBaseDataForm());
    act(() => {
      result.current.openEdit(profile);
    });
    act(() => {
      result.current.setField('birthDate', '1978-03-15');
    });
    await act(async () => {
      await result.current.submit();
    });

    const stored = await new ProfileRepository().getById(profile.id);
    expect(stored?.baseData.birthDate).toBe('1978-03-15');
    expect(stored?.baseData.age).toBeUndefined(); // legacy field cleared
  });

  it('Q4 migration: empty birthDate keeps legacy age untouched', async () => {
    const profile = await ensureProfile({
      baseData: {
        name: 'Dora',
        age: 52,
        birthDate: undefined,
        weightHistory: [],
        knownDiagnoses: [],
        currentMedications: [],
        relevantLimitations: [],
        profileType: 'self',
      },
    });

    const { result } = renderHook(() => useProfileBaseDataForm());
    act(() => {
      result.current.openEdit(profile);
    });
    // Don't set birthDate; just edit name.
    act(() => {
      result.current.setField('name', 'Dora Marie');
    });
    await act(async () => {
      await result.current.submit();
    });

    const stored = await new ProfileRepository().getById(profile.id);
    expect(stored?.baseData.birthDate).toBeUndefined();
    expect(stored?.baseData.age).toBe(52); // preserved
  });

  it('preserves out-of-scope baseData fields verbatim (height, weight, doctor, contextNotes)', async () => {
    const profile = await ensureProfile({
      baseData: {
        name: 'Eva',
        heightCm: 168,
        weightKg: 65,
        targetWeightKg: 62,
        weightHistory: [{ date: '2026-01-01', weightKg: 67 }],
        primaryDoctor: { name: 'Dr. Beispiel', specialty: 'Allgemein' },
        contextNotes: 'Markdown notes here',
        knownDiagnoses: [],
        currentMedications: [],
        relevantLimitations: [],
        profileType: 'self',
      },
    });

    const { result } = renderHook(() => useProfileBaseDataForm());
    act(() => {
      result.current.openEdit(profile);
    });
    act(() => {
      result.current.setField('name', 'Eva Maria');
    });
    await act(async () => {
      await result.current.submit();
    });

    const stored = await new ProfileRepository().getById(profile.id);
    expect(stored?.baseData.heightCm).toBe(168);
    expect(stored?.baseData.weightKg).toBe(65);
    expect(stored?.baseData.targetWeightKg).toBe(62);
    expect(stored?.baseData.weightHistory).toEqual([{ date: '2026-01-01', weightKg: 67 }]);
    expect(stored?.baseData.primaryDoctor?.name).toBe('Dr. Beispiel');
    expect(stored?.baseData.contextNotes).toBe('Markdown notes here');
    // profileType preserved too
    expect(stored?.baseData.profileType).toBe('self');
  });

  it('trims and drops empty strings from arrays on save', async () => {
    const profile = await ensureProfile();
    const { result } = renderHook(() => useProfileBaseDataForm());
    act(() => {
      result.current.openEdit(profile);
    });
    act(() => {
      result.current.setField('knownDiagnoses', ['', '  Asthma  ', '   ', 'Hypertonie']);
    });
    await act(async () => {
      await result.current.submit();
    });

    const stored = await new ProfileRepository().getById(profile.id);
    expect(stored?.baseData.knownDiagnoses).toEqual(['Asthma', 'Hypertonie']);
  });

  it('close resets state to closed', async () => {
    const profile = await ensureProfile();
    const { result } = renderHook(() => useProfileBaseDataForm());
    act(() => {
      result.current.openEdit(profile);
    });
    act(() => result.current.close());
    expect(result.current.state.kind).toBe('closed');
  });

  it('submit error keeps modal open with detail', async () => {
    const profile = await ensureProfile();
    const profileRepo = new ProfileRepository();
    profileRepo.serialize = async () => {
      throw new Error('encryption failure');
    };
    const { result } = renderHook(() =>
      useProfileBaseDataForm({ repos: { profile: profileRepo } }),
    );
    act(() => {
      result.current.openEdit(profile);
    });
    act(() => {
      result.current.setField('name', 'X');
    });
    await act(async () => {
      await result.current.submit();
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.error).toContain('encryption failure');
  });
});
