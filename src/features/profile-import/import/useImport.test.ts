import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../../crypto';
import { setupCompletedOnboarding } from '../../../db/test-helpers';
import { readMeta } from '../../../db/meta';
import { ProfileRepository, ObservationRepository } from '../../../db/repositories';
import { useImport } from './useImport';

const TEST_PASSWORD = 'test-password-12';
let profileId: string;

const MINIMAL_MARKDOWN = [
  '# Medizinisches Profil - Version 1.0',
  '',
  '## 1. Basisdaten',
  '- **Alter:** 40',
  '',
  '## 2. Relevante Vorgeschichte',
  '### 2.1 Knie',
  '- **Beobachtung:** Schmerz.',
  '- **Muster:** Belastung.',
  '- **Selbstregulation:** Training.',
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

describe('useImport', () => {
  it('initial state is entry', () => {
    const { result } = renderHook(() => useImport());
    expect(result.current.state.kind).toBe('entry');
  });

  it('loadMarkdown moves entry -> profile-selection on valid input', async () => {
    const { result } = renderHook(() => useImport());
    await act(async () => {
      await result.current.loadMarkdown(MINIMAL_MARKDOWN);
    });
    expect(result.current.state.kind).toBe('profile-selection');
  });

  it('loadMarkdown sets error for empty/unparseable input', async () => {
    const { result } = renderHook(() => useImport());
    await act(async () => {
      await result.current.loadMarkdown('');
    });
    expect(result.current.state.kind).toBe('error');
    if (result.current.state.kind === 'error') {
      expect(result.current.state.message).toMatch(/Lebende.*Gesundheit|interpretierbar/i);
    }
  });

  it('loadMarkdown accepts a parse result with only a profile update (no entities)', async () => {
    // A parse result with a profile but zero entities should NOT be
    // treated as empty. This kills the isEmptyParseResult mutant that
    // flips `r.profile === null` to `true`.
    const PROFILE_ONLY_MARKDOWN = [
      '# Medizinisches Profil - Version 2.0',
      '',
      '## 1. Basisdaten',
      '- **Alter:** 55',
    ].join('\n');
    const { result } = renderHook(() => useImport());
    await act(async () => {
      await result.current.loadMarkdown(PROFILE_ONLY_MARKDOWN);
    });
    // Should move to profile-selection, not error
    expect(result.current.state.kind).toBe('profile-selection');
  });

  it('selectProfile on empty target goes to preview', async () => {
    const { result } = renderHook(() => useImport());
    await act(async () => {
      await result.current.loadMarkdown(MINIMAL_MARKDOWN);
    });
    await act(async () => {
      await result.current.selectProfile(profileId);
    });
    expect(result.current.state.kind).toBe('preview');
  });

  it('selectProfile on non-empty target goes to confirm-replace with existing counts', async () => {
    const obsRepo = new ObservationRepository();
    await obsRepo.create({
      profileId,
      theme: 'Existing',
      fact: 'x',
      pattern: 'x',
      selfRegulation: 'x',
      status: 'x',
      source: 'user',
      extraSections: {},
    });

    const { result } = renderHook(() => useImport());
    await act(async () => {
      await result.current.loadMarkdown(MINIMAL_MARKDOWN);
    });
    await act(async () => {
      await result.current.selectProfile(profileId);
    });

    expect(result.current.state.kind).toBe('confirm-replace');
    if (result.current.state.kind === 'confirm-replace') {
      expect(result.current.state.existingCounts.observations).toBe(1);
      expect(result.current.state.targetProfileId).toBe(profileId);
    }
  });

  it('confirmReplace moves confirm-replace -> preview', async () => {
    const obsRepo = new ObservationRepository();
    await obsRepo.create({
      profileId,
      theme: 'X',
      fact: 'x',
      pattern: 'x',
      selfRegulation: 'x',
      status: 'x',
      source: 'user',
      extraSections: {},
    });

    const { result } = renderHook(() => useImport());
    await act(async () => {
      await result.current.loadMarkdown(MINIMAL_MARKDOWN);
    });
    await act(async () => {
      await result.current.selectProfile(profileId);
    });
    act(() => {
      result.current.confirmReplace();
    });
    expect(result.current.state.kind).toBe('preview');
  });

  it('startImport succeeds and transitions preview -> done', async () => {
    const { result } = renderHook(() => useImport());
    await act(async () => {
      await result.current.loadMarkdown(MINIMAL_MARKDOWN);
    });
    await act(async () => {
      await result.current.selectProfile(profileId);
    });
    await act(async () => {
      await result.current.startImport();
    });
    await waitFor(() => expect(result.current.state.kind).toBe('done'));
    if (result.current.state.kind === 'done') {
      expect(result.current.state.importResult.targetProfileId).toBe(profileId);
      expect(result.current.state.importResult.created.observations).toBe(1);
    }
  });

  it('startImport on error routes to error state', async () => {
    const { result } = renderHook(() => useImport());
    await act(async () => {
      await result.current.loadMarkdown(MINIMAL_MARKDOWN);
    });
    await act(async () => {
      // Jump straight to preview with a bad profile id to force a downstream error
      await result.current.selectProfile('nonexistent-id');
    });
    await act(async () => {
      await result.current.startImport();
    });
    expect(result.current.state.kind).toBe('error');
  });

  it('cancel returns to entry from any state', async () => {
    const { result } = renderHook(() => useImport());
    await act(async () => {
      await result.current.loadMarkdown(MINIMAL_MARKDOWN);
    });
    expect(result.current.state.kind).toBe('profile-selection');

    act(() => {
      result.current.cancel();
    });
    expect(result.current.state.kind).toBe('entry');
  });

  it('reset from done returns to entry', async () => {
    const { result } = renderHook(() => useImport());
    await act(async () => {
      await result.current.loadMarkdown(MINIMAL_MARKDOWN);
    });
    await act(async () => {
      await result.current.selectProfile(profileId);
    });
    await act(async () => {
      await result.current.startImport();
    });
    await waitFor(() => expect(result.current.state.kind).toBe('done'));
    act(() => {
      result.current.reset();
    });
    expect(result.current.state.kind).toBe('entry');
  });

  it('selectProfile does nothing when not in profile-selection state', async () => {
    const { result } = renderHook(() => useImport());
    await act(async () => {
      await result.current.selectProfile(profileId);
    });
    expect(result.current.state.kind).toBe('entry');
  });

  it('confirmReplace does nothing when not in confirm-replace state', () => {
    const { result } = renderHook(() => useImport());
    act(() => {
      result.current.confirmReplace();
    });
    expect(result.current.state.kind).toBe('entry');
  });

  it('startImport does nothing when not in preview state', async () => {
    const { result } = renderHook(() => useImport());
    await act(async () => {
      await result.current.startImport();
    });
    expect(result.current.state.kind).toBe('entry');
  });
});
