import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, act } from '@testing-library/react';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { ProfileRepository, SupplementRepository } from '../../db/repositories';
import type { Supplement } from '../../domain';
import { useSupplementForm } from './useSupplementForm';

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

async function makeSupplement(
  profileId: string,
  overrides: Partial<Supplement> = {},
): Promise<Supplement> {
  return new SupplementRepository().create({
    profileId,
    name: 'Vitamin D3 2000 IE',
    category: 'daily',
    ...overrides,
  });
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
});

describe('useSupplementForm', () => {
  it('starts in closed state', () => {
    const { result } = renderHook(() => useSupplementForm());
    expect(result.current.state.kind).toBe('closed');
  });

  it('openCreate seeds blank fields with empty category placeholder', () => {
    const { result } = renderHook(() => useSupplementForm());
    act(() => {
      result.current.openCreate();
    });

    expect(result.current.state.kind).toBe('open');
    if (result.current.state.kind !== 'open') return;
    expect(result.current.state.mode.kind).toBe('create');
    expect(result.current.state.fields.name).toBe('');
    expect(result.current.state.fields.brand).toBe('');
    expect(result.current.state.fields.category).toBe(''); // Q5: empty default
    expect(result.current.state.fields.recommendation).toBe('');
    expect(result.current.state.fields.rationale).toBe('');
  });

  it('openEdit prefills from supplement', async () => {
    const profileId = await ensureProfile();
    const supplement = await makeSupplement(profileId, {
      name: 'Magnesium',
      brand: 'tetesept',
      category: 'regular',
      recommendation: 'Abends mit Wasser',
      rationale: 'Krampfneigung in den Waden',
    });

    const { result } = renderHook(() => useSupplementForm());
    act(() => {
      result.current.openEdit(supplement);
    });

    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.mode.kind).toBe('edit');
    expect(result.current.state.fields.name).toBe('Magnesium');
    expect(result.current.state.fields.brand).toBe('tetesept');
    expect(result.current.state.fields.category).toBe('regular');
    expect(result.current.state.fields.recommendation).toBe('Abends mit Wasser');
    expect(result.current.state.fields.rationale).toBe('Krampfneigung in den Waden');
  });

  it('setField mutates the corresponding field', () => {
    const { result } = renderHook(() => useSupplementForm());
    act(() => {
      result.current.openCreate();
    });
    act(() => {
      result.current.setField('name', 'Omega 3');
      result.current.setField('category', 'daily');
      result.current.setField('brand', 'NOW Foods');
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.fields.name).toBe('Omega 3');
    expect(result.current.state.fields.category).toBe('daily');
    expect(result.current.state.fields.brand).toBe('NOW Foods');
  });

  it('submit gated when name is empty (no write, modal stays open)', async () => {
    const profileId = await ensureProfile();
    const { result } = renderHook(() => useSupplementForm());
    act(() => {
      result.current.openCreate();
    });
    act(() => {
      result.current.setField('category', 'daily');
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.state.kind).toBe('open');
    const supplements = await new SupplementRepository().listByProfile(profileId);
    expect(supplements).toHaveLength(0);
  });

  it('submit gated when category is empty (placeholder option non-submittable)', async () => {
    const profileId = await ensureProfile();
    const { result } = renderHook(() => useSupplementForm());
    act(() => {
      result.current.openCreate();
    });
    act(() => {
      result.current.setField('name', 'Magnesium');
      // category intentionally left at '' — placeholder option
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.state.kind).toBe('open');
    const supplements = await new SupplementRepository().listByProfile(profileId);
    expect(supplements).toHaveLength(0);
  });

  it('submit gated when name is whitespace only', async () => {
    const profileId = await ensureProfile();
    const { result } = renderHook(() => useSupplementForm());
    act(() => {
      result.current.openCreate();
    });
    act(() => {
      result.current.setField('name', '   ');
      result.current.setField('category', 'daily');
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.state.kind).toBe('open');
    const supplements = await new SupplementRepository().listByProfile(profileId);
    expect(supplements).toHaveLength(0);
  });

  it('submit-create writes a new supplement, trims name, coerces empty optionals to undefined', async () => {
    const profileId = await ensureProfile();
    let committed = false;
    const { result } = renderHook(() =>
      useSupplementForm({
        onCommitted: () => {
          committed = true;
        },
      }),
    );
    act(() => {
      result.current.openCreate();
    });
    act(() => {
      result.current.setField('name', '  Vitamin D3 2000 IE  ');
      result.current.setField('category', 'daily');
      result.current.setField('brand', '   '); // whitespace -> undefined
      result.current.setField('recommendation', ''); // empty -> undefined
      result.current.setField('rationale', 'Bluttest Dez 2024');
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(committed).toBe(true);
    expect(result.current.state.kind).toBe('closed');

    const supplements = await new SupplementRepository().listByProfile(profileId);
    expect(supplements).toHaveLength(1);
    expect(supplements[0]?.name).toBe('Vitamin D3 2000 IE');
    expect(supplements[0]?.category).toBe('daily');
    expect(supplements[0]?.brand).toBeUndefined();
    expect(supplements[0]?.recommendation).toBeUndefined();
    expect(supplements[0]?.rationale).toBe('Bluttest Dez 2024');
  });

  it('submit-edit preserves sourceDocumentId verbatim (provenance round-trip guard)', async () => {
    const profileId = await ensureProfile();
    const supplement = await makeSupplement(profileId, {
      name: 'Vitamin D3 2000 IE',
      sourceDocumentId: 'doc-from-import',
    });

    const { result } = renderHook(() => useSupplementForm());
    act(() => {
      result.current.openEdit(supplement);
    });
    act(() => {
      result.current.setField('name', 'Vitamin D3 4000 IE');
    });
    await act(async () => {
      await result.current.submit();
    });

    const updated = await new SupplementRepository().getById(supplement.id);
    expect(updated?.name).toBe('Vitamin D3 4000 IE');
    expect(updated?.sourceDocumentId).toBe('doc-from-import');
    expect(updated?.profileId).toBe(profileId);
  });

  it('submit-edit allows re-categorization (groups reshuffle via refetch)', async () => {
    const profileId = await ensureProfile();
    const supplement = await makeSupplement(profileId, {
      name: 'Magnesium',
      category: 'daily',
    });

    const { result } = renderHook(() => useSupplementForm());
    act(() => {
      result.current.openEdit(supplement);
    });
    act(() => {
      result.current.setField('category', 'paused');
    });
    await act(async () => {
      await result.current.submit();
    });

    const updated = await new SupplementRepository().getById(supplement.id);
    expect(updated?.category).toBe('paused');

    const repo = new SupplementRepository();
    const dailyList = await repo.listByCategory(profileId, 'daily');
    expect(dailyList).toHaveLength(0);
    const pausedList = await repo.listByCategory(profileId, 'paused');
    expect(pausedList).toHaveLength(1);
  });

  it('openDelete + confirmDelete removes only the target, leaves siblings intact', async () => {
    const profileId = await ensureProfile();
    const target = await makeSupplement(profileId, { name: 'Magnesium' });
    await makeSupplement(profileId, { name: 'Vitamin D3' });
    await makeSupplement(profileId, { name: 'Omega 3' });

    let committed = false;
    const { result } = renderHook(() =>
      useSupplementForm({
        onCommitted: () => {
          committed = true;
        },
      }),
    );
    act(() => {
      result.current.openDelete(target);
    });
    await act(async () => {
      await result.current.confirmDelete();
    });
    expect(committed).toBe(true);
    expect(result.current.state.kind).toBe('closed');

    const remaining = await new SupplementRepository().listByProfile(profileId);
    expect(remaining).toHaveLength(2);
    expect(remaining.map((s) => s.name).sort()).toEqual(['Omega 3', 'Vitamin D3']);
  });

  it('close resets state to closed', () => {
    const { result } = renderHook(() => useSupplementForm());
    act(() => {
      result.current.openCreate();
    });
    act(() => result.current.close());
    expect(result.current.state.kind).toBe('closed');
  });

  it('submit error keeps modal open and surfaces detail', async () => {
    await ensureProfile();
    const repo = new SupplementRepository();
    repo.create = async () => {
      throw new Error('quota exceeded');
    };
    const { result } = renderHook(() => useSupplementForm({ repos: { supplement: repo } }));
    act(() => {
      result.current.openCreate();
    });
    act(() => {
      result.current.setField('name', 'X');
      result.current.setField('category', 'daily');
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
    const supplement = await makeSupplement(profileId);
    const repo = new SupplementRepository();
    repo.delete = async () => {
      throw new Error('crypto failure');
    };
    const { result } = renderHook(() => useSupplementForm({ repos: { supplement: repo } }));
    act(() => {
      result.current.openDelete(supplement);
    });
    await act(async () => {
      await result.current.confirmDelete();
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.error).toContain('crypto failure');
  });

  it('opening create after close shows blank fields (per-open isolation)', () => {
    const { result } = renderHook(() => useSupplementForm());
    act(() => {
      result.current.openCreate();
    });
    act(() => {
      result.current.setField('name', 'Temp');
      result.current.setField('category', 'daily');
    });
    act(() => result.current.close());
    act(() => {
      result.current.openCreate();
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.fields.name).toBe('');
    expect(result.current.state.fields.category).toBe('');
  });
});
