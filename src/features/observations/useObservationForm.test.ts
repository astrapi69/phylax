import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, act } from '@testing-library/react';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { ObservationRepository, ProfileRepository } from '../../db/repositories';
import type { Observation } from '../../domain';
import { useObservationForm } from './useObservationForm';

const TEST_PASSWORD = 'test-password-12';

async function unlockCurrent(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function ensureProfile(): Promise<string> {
  const repo = new ProfileRepository();
  const existing = await repo.getCurrentProfile();
  if (existing) return existing.id;
  const created = await repo.create({
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
  return created.id;
}

async function makeObservation(
  profileId: string,
  overrides: Partial<Observation> = {},
): Promise<Observation> {
  return new ObservationRepository().create({
    profileId,
    theme: 'Schulter',
    fact: 'Schmerz beim Heben',
    pattern: 'Bei Belastung',
    selfRegulation: 'Krafttraining',
    status: 'in Besserung',
    source: 'user',
    extraSections: {},
    ...overrides,
  });
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
});

describe('useObservationForm', () => {
  it('starts in closed state', () => {
    const { result } = renderHook(() => useObservationForm());
    expect(result.current.state.kind).toBe('closed');
  });

  it('openCreate seeds blank fields + loads themes alphabetically', async () => {
    const profileId = await ensureProfile();
    await makeObservation(profileId, { theme: 'Schulter' });
    await makeObservation(profileId, { theme: 'Blutdruck' });

    const { result } = renderHook(() => useObservationForm());
    await act(async () => {
      await result.current.openCreate();
    });

    expect(result.current.state.kind).toBe('open');
    if (result.current.state.kind !== 'open') return;
    expect(result.current.state.mode.kind).toBe('create');
    expect(result.current.state.fields.theme).toBe('');
    expect(result.current.state.themes).toEqual(['Blutdruck', 'Schulter']);
  });

  it('openEdit prefills from observation', async () => {
    const profileId = await ensureProfile();
    const obs = await makeObservation(profileId, { theme: 'Knie', fact: 'Lokaler Schmerz' });

    const { result } = renderHook(() => useObservationForm());
    await act(async () => {
      await result.current.openEdit(obs);
    });

    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.mode.kind).toBe('edit');
    expect(result.current.state.fields.theme).toBe('Knie');
    expect(result.current.state.fields.fact).toBe('Lokaler Schmerz');
  });

  it('setField mutates the corresponding field', async () => {
    await ensureProfile();
    const { result } = renderHook(() => useObservationForm());
    await act(async () => {
      await result.current.openCreate();
    });
    act(() => {
      result.current.setField('theme', 'Schulter');
      result.current.setField('fact', 'neu');
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.fields.theme).toBe('Schulter');
    expect(result.current.state.fields.fact).toBe('neu');
  });

  it('submit is gated when theme is empty (no write, modal stays open)', async () => {
    const profileId = await ensureProfile();
    const { result } = renderHook(() => useObservationForm());
    await act(async () => {
      await result.current.openCreate();
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.state.kind).toBe('open');
    const obsList = await new ObservationRepository().listByProfile(profileId);
    expect(obsList).toHaveLength(0);
  });

  it('submit-create writes a new observation with source=user', async () => {
    const profileId = await ensureProfile();
    let committed = false;
    const { result } = renderHook(() =>
      useObservationForm({
        onCommitted: () => {
          committed = true;
        },
      }),
    );
    await act(async () => {
      await result.current.openCreate();
    });
    act(() => {
      result.current.setField('theme', 'Schulter');
      result.current.setField('fact', 'Test');
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(committed).toBe(true);
    expect(result.current.state.kind).toBe('closed');
    const obsList = await new ObservationRepository().listByProfile(profileId);
    expect(obsList).toHaveLength(1);
    expect(obsList[0]?.theme).toBe('Schulter');
    expect(obsList[0]?.source).toBe('user');
    expect(obsList[0]?.extraSections).toEqual({});
  });

  it('submit-edit preserves source, sourceDocumentId, extraSections (Q3 regression guard)', async () => {
    const profileId = await ensureProfile();
    const obs = await makeObservation(profileId, {
      theme: 'Schulter',
      source: 'ai',
      sourceDocumentId: 'doc-from-import',
      extraSections: { Ursprung: 'AI-Extraktion' },
    });

    const { result } = renderHook(() => useObservationForm());
    await act(async () => {
      await result.current.openEdit(obs);
    });
    act(() => {
      result.current.setField('theme', 'Schulter (links)');
      result.current.setField('fact', 'aktualisierter Befund');
    });
    await act(async () => {
      await result.current.submit();
    });

    const updated = await new ObservationRepository().getById(obs.id);
    expect(updated?.theme).toBe('Schulter (links)');
    expect(updated?.fact).toBe('aktualisierter Befund');
    // Provenance fields preserved verbatim.
    expect(updated?.source).toBe('ai');
    expect(updated?.sourceDocumentId).toBe('doc-from-import');
    expect(updated?.extraSections).toEqual({ Ursprung: 'AI-Extraktion' });
  });

  it('openDelete + confirmDelete removes the observation', async () => {
    const profileId = await ensureProfile();
    const obs = await makeObservation(profileId);

    let committed = false;
    const { result } = renderHook(() =>
      useObservationForm({
        onCommitted: () => {
          committed = true;
        },
      }),
    );
    act(() => {
      result.current.openDelete(obs);
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.mode.kind).toBe('delete');

    await act(async () => {
      await result.current.confirmDelete();
    });
    expect(committed).toBe(true);
    expect(result.current.state.kind).toBe('closed');
    const remaining = await new ObservationRepository().listByProfile(profileId);
    expect(remaining).toHaveLength(0);
  });

  it('close resets state to closed', async () => {
    await ensureProfile();
    const { result } = renderHook(() => useObservationForm());
    await act(async () => {
      await result.current.openCreate();
    });
    act(() => result.current.close());
    expect(result.current.state.kind).toBe('closed');
  });

  it('submit error keeps modal open and surfaces detail', async () => {
    await ensureProfile();
    const obsRepo = new ObservationRepository();
    obsRepo.create = async () => {
      throw new Error('quota exceeded');
    };
    const { result } = renderHook(() => useObservationForm({ repos: { observation: obsRepo } }));
    await act(async () => {
      await result.current.openCreate();
    });
    act(() => {
      result.current.setField('theme', 'Schulter');
    });
    await act(async () => {
      await result.current.submit();
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.error).toContain('quota exceeded');
    expect(result.current.state.submitting).toBe(false);
  });

  it('confirmDelete error keeps modal open with delete error', async () => {
    const profileId = await ensureProfile();
    const obs = await makeObservation(profileId);
    const obsRepo = new ObservationRepository();
    obsRepo.delete = async () => {
      throw new Error('crypto failure');
    };
    const { result } = renderHook(() => useObservationForm({ repos: { observation: obsRepo } }));
    act(() => result.current.openDelete(obs));
    await act(async () => {
      await result.current.confirmDelete();
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.error).toContain('crypto failure');
  });

  it('opening create after close shows blank fields (per-open isolation)', async () => {
    await ensureProfile();
    const { result } = renderHook(() => useObservationForm());
    await act(async () => {
      await result.current.openCreate();
    });
    act(() => {
      result.current.setField('theme', 'Temp');
      result.current.setField('fact', 'temp fact');
    });
    act(() => result.current.close());
    await act(async () => {
      await result.current.openCreate();
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.fields.theme).toBe('');
    expect(result.current.state.fields.fact).toBe('');
  });

  it('submit trims the theme on write', async () => {
    const profileId = await ensureProfile();
    const { result } = renderHook(() => useObservationForm());
    await act(async () => {
      await result.current.openCreate();
    });
    act(() => {
      result.current.setField('theme', '   Schulter   ');
    });
    await act(async () => {
      await result.current.submit();
    });
    const obsList = await new ObservationRepository().listByProfile(profileId);
    expect(obsList[0]?.theme).toBe('Schulter');
  });

  it('coerces empty optional string to undefined on commit', async () => {
    const profileId = await ensureProfile();
    const { result } = renderHook(() => useObservationForm());
    await act(async () => {
      await result.current.openCreate();
    });
    act(() => {
      result.current.setField('theme', 'Knie');
      result.current.setField('medicalFinding', '   ');
    });
    await act(async () => {
      await result.current.submit();
    });
    const obsList = await new ObservationRepository().listByProfile(profileId);
    expect(obsList[0]?.medicalFinding).toBeUndefined();
  });
});
