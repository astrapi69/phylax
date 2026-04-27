import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, act } from '@testing-library/react';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { OpenPointRepository, ProfileRepository } from '../../db/repositories';
import type { OpenPoint } from '../../domain';
import { useOpenPointForm } from './useOpenPointForm';

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

async function makeOpenPoint(
  profileId: string,
  overrides: Partial<OpenPoint> = {},
): Promise<OpenPoint> {
  return new OpenPointRepository().create({
    profileId,
    text: 'Wiederholungs-Blutabnahme',
    context: 'Hausarzt',
    resolved: false,
    ...overrides,
  });
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
});

describe('useOpenPointForm', () => {
  it('starts in closed state', () => {
    const { result } = renderHook(() => useOpenPointForm());
    expect(result.current.state.kind).toBe('closed');
    expect(result.current.togglingId).toBeNull();
    expect(result.current.toggleError).toBeNull();
  });

  it('openCreate seeds blank fields and loads context datalist', async () => {
    const profileId = await ensureProfile();
    await makeOpenPoint(profileId, { context: 'Hausarzt' });
    await makeOpenPoint(profileId, { context: 'Älphabet erst' });

    const { result } = renderHook(() => useOpenPointForm());
    await act(async () => {
      await result.current.openCreate();
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.fields.text).toBe('');
    expect(result.current.state.fields.context).toBe('');
    // German collator orders Ä before H.
    expect([...result.current.state.contexts]).toEqual(['Älphabet erst', 'Hausarzt']);
  });

  it('openEdit prefills fields from point', async () => {
    const profileId = await ensureProfile();
    const point = await makeOpenPoint(profileId, {
      text: 'MRT besprechen',
      context: 'Beim nächsten Arztbesuch',
      priority: 'hoch',
      timeHorizon: 'Innerhalb 3 Monate',
      details: 'Linke Schulter',
    });

    const { result } = renderHook(() => useOpenPointForm());
    await act(async () => {
      await result.current.openEdit(point);
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.fields.text).toBe('MRT besprechen');
    expect(result.current.state.fields.context).toBe('Beim nächsten Arztbesuch');
    expect(result.current.state.fields.priority).toBe('hoch');
    expect(result.current.state.fields.timeHorizon).toBe('Innerhalb 3 Monate');
    expect(result.current.state.fields.details).toBe('Linke Schulter');
  });

  it('submit gated when text is empty', async () => {
    const profileId = await ensureProfile();
    const { result } = renderHook(() => useOpenPointForm());
    await act(async () => {
      await result.current.openCreate();
    });
    act(() => {
      result.current.setField('context', 'Hausarzt');
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.state.kind).toBe('open');
    const all = await new OpenPointRepository().listByProfile(profileId);
    expect(all).toHaveLength(0);
  });

  it('submit gated when context is empty', async () => {
    const profileId = await ensureProfile();
    const { result } = renderHook(() => useOpenPointForm());
    await act(async () => {
      await result.current.openCreate();
    });
    act(() => {
      result.current.setField('text', 'foo');
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.state.kind).toBe('open');
    const all = await new OpenPointRepository().listByProfile(profileId);
    expect(all).toHaveLength(0);
  });

  it('submit-create writes a new point with optional fields coerced to undefined', async () => {
    const profileId = await ensureProfile();
    let committed = false;
    const { result } = renderHook(() =>
      useOpenPointForm({
        onCommitted: () => {
          committed = true;
        },
      }),
    );
    await act(async () => {
      await result.current.openCreate();
    });
    act(() => {
      result.current.setField('text', '  Blutabnahme  ');
      result.current.setField('context', 'Hausarzt');
      result.current.setField('priority', '   '); // whitespace -> undefined
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(committed).toBe(true);
    expect(result.current.state.kind).toBe('closed');

    const all = await new OpenPointRepository().listByProfile(profileId);
    expect(all).toHaveLength(1);
    expect(all[0]?.text).toBe('Blutabnahme');
    expect(all[0]?.context).toBe('Hausarzt');
    expect(all[0]?.priority).toBeUndefined();
    expect(all[0]?.resolved).toBe(false);
  });

  it('submit-edit preserves sourceDocumentId + resolved verbatim (provenance round-trip)', async () => {
    const profileId = await ensureProfile();
    const point = await makeOpenPoint(profileId, {
      text: 'Ursprung',
      context: 'Hausarzt',
      resolved: true,
      sourceDocumentId: 'doc-from-import',
    });

    const { result } = renderHook(() => useOpenPointForm());
    await act(async () => {
      await result.current.openEdit(point);
    });
    act(() => {
      result.current.setField('text', 'Korrigiert');
    });
    await act(async () => {
      await result.current.submit();
    });

    const updated = await new OpenPointRepository().getById(point.id);
    expect(updated?.text).toBe('Korrigiert');
    expect(updated?.sourceDocumentId).toBe('doc-from-import');
    expect(updated?.resolved).toBe(true); // owned by toggle path, not edit form
  });

  it('submit-edit allows re-categorization (context change)', async () => {
    const profileId = await ensureProfile();
    const point = await makeOpenPoint(profileId, { context: 'Hausarzt' });

    const { result } = renderHook(() => useOpenPointForm());
    await act(async () => {
      await result.current.openEdit(point);
    });
    act(() => {
      result.current.setField('context', 'Dermatologe');
    });
    await act(async () => {
      await result.current.submit();
    });

    const updated = await new OpenPointRepository().getById(point.id);
    expect(updated?.context).toBe('Dermatologe');
  });

  it('toggle flips resolved and refreshes via onCommitted', async () => {
    const profileId = await ensureProfile();
    const point = await makeOpenPoint(profileId, { resolved: false });

    let commitCount = 0;
    const { result } = renderHook(() =>
      useOpenPointForm({
        onCommitted: () => {
          commitCount += 1;
        },
      }),
    );

    await act(async () => {
      await result.current.toggle(point);
    });

    expect(commitCount).toBe(1);
    expect(result.current.togglingId).toBeNull();
    expect(result.current.toggleError).toBeNull();

    const updated = await new OpenPointRepository().getById(point.id);
    expect(updated?.resolved).toBe(true);
  });

  it('toggle flips back to unresolved when called on resolved point', async () => {
    const profileId = await ensureProfile();
    const point = await makeOpenPoint(profileId, { resolved: true });

    const { result } = renderHook(() => useOpenPointForm());
    await act(async () => {
      await result.current.toggle(point);
    });

    const updated = await new OpenPointRepository().getById(point.id);
    expect(updated?.resolved).toBe(false);
  });

  it('toggle error sets toggleError, clears togglingId', async () => {
    const profileId = await ensureProfile();
    const point = await makeOpenPoint(profileId);
    const repo = new OpenPointRepository();
    repo.update = async () => {
      throw new Error('crypto failure');
    };

    const { result } = renderHook(() => useOpenPointForm({ repos: { openPoint: repo } }));
    await act(async () => {
      await result.current.toggle(point);
    });

    expect(result.current.toggleError).toContain('crypto failure');
    expect(result.current.togglingId).toBeNull();
  });

  it('openDelete + confirmDelete removes only target point', async () => {
    const profileId = await ensureProfile();
    const target = await makeOpenPoint(profileId, { text: 'Target' });
    await makeOpenPoint(profileId, { text: 'Sibling A' });
    await makeOpenPoint(profileId, { text: 'Sibling B' });

    let committed = false;
    const { result } = renderHook(() =>
      useOpenPointForm({
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

    const remaining = await new OpenPointRepository().listByProfile(profileId);
    expect(remaining).toHaveLength(2);
    expect(remaining.map((p) => p.text).sort()).toEqual(['Sibling A', 'Sibling B']);
  });

  it('submit error keeps modal open with detail', async () => {
    await ensureProfile();
    const repo = new OpenPointRepository();
    repo.create = async () => {
      throw new Error('quota exceeded');
    };
    const { result } = renderHook(() => useOpenPointForm({ repos: { openPoint: repo } }));
    await act(async () => {
      await result.current.openCreate();
    });
    act(() => {
      result.current.setField('text', 'X');
      result.current.setField('context', 'Y');
    });
    await act(async () => {
      await result.current.submit();
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.error).toContain('quota exceeded');
  });

  it('opening create after close shows blank fields (per-open isolation)', async () => {
    const { result } = renderHook(() => useOpenPointForm());
    await act(async () => {
      await result.current.openCreate();
    });
    act(() => {
      result.current.setField('text', 'Temp');
      result.current.setField('context', 'Tmp');
    });
    act(() => result.current.close());
    await act(async () => {
      await result.current.openCreate();
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.fields.text).toBe('');
    expect(result.current.state.fields.context).toBe('');
  });
});
