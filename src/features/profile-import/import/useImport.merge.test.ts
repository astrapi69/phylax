import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../../crypto';
import { setupCompletedOnboarding } from '../../../db/test-helpers';
import { readMeta } from '../../../db/meta';
import { ProfileRepository, ObservationRepository } from '../../../db/repositories';
import { useImport } from './useImport';
import * as detectModule from './detectMergeConflicts';

const TEST_PASSWORD = 'test-password-12';
let profileId: string;

// Markdown with one observation theme. Used to trigger conflict
// scenarios when an existing observation with the same theme is
// already present on the target profile.
const KNIE_MARKDOWN = [
  '# Medizinisches Profil - Version 1.0',
  '',
  '## 1. Basisdaten',
  '- **Alter:** 40',
  '',
  '## 2. Relevante Vorgeschichte',
  '### 2.1 Knie',
  '- **Beobachtung:** New observation text.',
  '- **Muster:** New pattern.',
  '- **Selbstregulation:** New self-reg.',
  '- **Status:** Akut',
].join('\n');

const HUEFTE_MARKDOWN = [
  '# Medizinisches Profil - Version 1.0',
  '',
  '## 1. Basisdaten',
  '- **Alter:** 40',
  '',
  '## 2. Relevante Vorgeschichte',
  '### 2.1 Hüfte',
  '- **Beobachtung:** Disjoint theme.',
  '- **Muster:** New pattern.',
  '- **Selbstregulation:** New self-reg.',
  '- **Status:** Stabil',
].join('\n');

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

  const profileRepo = new ProfileRepository();
  const profile = await profileRepo.create({
    baseData: {
      name: 'Ziel',
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
  profileId = profile.id;
});

async function seedKnieObservation(): Promise<string> {
  const obsRepo = new ObservationRepository();
  const created = await obsRepo.create({
    profileId,
    theme: 'Knie',
    fact: 'Existing fact',
    pattern: 'Existing pattern',
    selfRegulation: 'Existing self-reg',
    status: 'Stabil',
    source: 'user',
    extraSections: {},
  });
  return created.id;
}

async function getToPreviewWithMergeMode(
  result: ReturnType<typeof renderHook<ReturnType<typeof useImport>, unknown>>['result'],
  markdown: string,
): Promise<void> {
  await act(async () => {
    await result.current.loadMarkdown(markdown);
  });
  await act(async () => {
    await result.current.selectProfile(profileId);
  });
  // Existing data on the profile -> selectProfile lands on
  // confirm-replace. confirmReplace with merge mode lands on preview.
  if (result.current.state.kind === 'confirm-replace') {
    act(() => {
      result.current.confirmReplace({ observations: 'merge' });
    });
  }
}

describe('useImport state machine - IM-06 merge integration', () => {
  it("merge mode with zero conflicts skips 'conflict-resolution' and transitions preview -> importing -> done", async () => {
    // Disjoint theme: existing 'Knie' is preserved, parsed 'Hüfte'
    // is new. No conflicts surface; the path goes preview ->
    // importing -> done directly.
    await seedKnieObservation();
    const { result } = renderHook(() => useImport());
    await getToPreviewWithMergeMode(result, HUEFTE_MARKDOWN);
    expect(result.current.state.kind).toBe('preview');

    await act(async () => {
      await result.current.startImport();
    });
    expect(result.current.state.kind).toBe('done');
    if (result.current.state.kind === 'done') {
      expect(result.current.state.importResult.targetProfileId).toBe(profileId);
    }
  });

  it('merge mode with at least one conflict transitions preview -> conflict-resolution', async () => {
    // Existing 'Knie' + parsed 'Knie' with differing fact -> conflict.
    await seedKnieObservation();
    const { result } = renderHook(() => useImport());
    await getToPreviewWithMergeMode(result, KNIE_MARKDOWN);
    expect(result.current.state.kind).toBe('preview');

    await act(async () => {
      await result.current.startImport();
    });

    expect(result.current.state.kind).toBe('conflict-resolution');
    if (result.current.state.kind === 'conflict-resolution') {
      expect(result.current.state.conflicts.observations).toHaveLength(1);
      expect(result.current.state.conflicts.observations[0]?.outcome).toBe('conflict');
      expect(result.current.state.replaceSelection).toEqual({ observations: 'merge' });
    }
  });

  it('submitResolutions transitions conflict-resolution -> importing -> done with passed resolutions', async () => {
    const existingId = await seedKnieObservation();
    const { result } = renderHook(() => useImport());
    await getToPreviewWithMergeMode(result, KNIE_MARKDOWN);
    await act(async () => {
      await result.current.startImport();
    });
    expect(result.current.state.kind).toBe('conflict-resolution');

    await act(async () => {
      await result.current.submitResolutions({
        observations: { [existingId]: { kind: 'theirs' } },
      });
    });

    expect(result.current.state.kind).toBe('done');

    // Verify the patch landed: existing row updated to parsed fact.
    const obsRepo = new ObservationRepository();
    const stored = await obsRepo.listByProfile(profileId);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.id).toBe(existingId);
    expect(stored[0]?.fact).toBe('New observation text.');
  });

  it("submitResolutions with empty resolutions on a conflicting set surfaces 'error' (UI bug discipline)", async () => {
    await seedKnieObservation();
    const { result } = renderHook(() => useImport());
    await getToPreviewWithMergeMode(result, KNIE_MARKDOWN);
    await act(async () => {
      await result.current.startImport();
    });
    expect(result.current.state.kind).toBe('conflict-resolution');

    await act(async () => {
      // Q2 violation: submit nothing despite a conflict existing.
      await result.current.submitResolutions({});
    });

    expect(result.current.state.kind).toBe('error');
  });

  it("cancel from 'conflict-resolution' returns to 'entry' without writing (W3)", async () => {
    const existingId = await seedKnieObservation();
    const { result } = renderHook(() => useImport());
    await getToPreviewWithMergeMode(result, KNIE_MARKDOWN);
    await act(async () => {
      await result.current.startImport();
    });
    expect(result.current.state.kind).toBe('conflict-resolution');

    act(() => {
      result.current.cancel();
    });

    expect(result.current.state.kind).toBe('entry');
    // Vault unchanged: existing observation still has its old fact.
    const obsRepo = new ObservationRepository();
    const stored = await obsRepo.listByProfile(profileId);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.id).toBe(existingId);
    expect(stored[0]?.fact).toBe('Existing fact');
  });

  it("pre-transaction non-conflict error in detectMergeConflicts routes to 'error', not 'conflict-resolution'", async () => {
    // W4 lock: only user-decision conflicts surface as
    // 'conflict-resolution'. A load failure routes to 'error'.
    await seedKnieObservation();
    vi.spyOn(detectModule, 'detectMergeConflicts').mockRejectedValueOnce(
      new Error('synthetic load failure'),
    );

    const { result } = renderHook(() => useImport());
    await getToPreviewWithMergeMode(result, KNIE_MARKDOWN);
    await act(async () => {
      await result.current.startImport();
    });

    expect(result.current.state.kind).toBe('error');
    if (result.current.state.kind === 'error') {
      expect(result.current.state.detail).toBe('synthetic load failure');
    }
    vi.restoreAllMocks();
  });

  it("submitResolutions outside 'conflict-resolution' is a no-op", async () => {
    const { result } = renderHook(() => useImport());
    expect(result.current.state.kind).toBe('entry');

    await act(async () => {
      await result.current.submitResolutions({});
    });

    // Still entry; no transition.
    expect(result.current.state.kind).toBe('entry');
  });

  it('non-merge replaceSelection skips conflict detection entirely', async () => {
    // Even with overlapping data, replace mode does not surface
    // 'conflict-resolution' (replace destroys existing, no user
    // decision needed beyond the ConfirmDialog itself).
    await seedKnieObservation();
    const { result } = renderHook(() => useImport());
    await act(async () => {
      await result.current.loadMarkdown(KNIE_MARKDOWN);
    });
    await act(async () => {
      await result.current.selectProfile(profileId);
    });
    if (result.current.state.kind === 'confirm-replace') {
      act(() => {
        result.current.confirmReplace({ observations: 'replace' });
      });
    }
    expect(result.current.state.kind).toBe('preview');

    await act(async () => {
      await result.current.startImport();
    });
    expect(result.current.state.kind).toBe('done');
  });
});
