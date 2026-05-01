import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../../crypto';
import { setupCompletedOnboarding } from '../../../db/test-helpers';
import { readMeta } from '../../../db/meta';
import { ProfileRepository, ObservationRepository } from '../../../db/repositories';
import { saveAIConfig } from '../../../db/aiConfig';
import * as aiCallModule from '../../ai/aiCall';
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

  it('loadMarkdown routes empty/unparseable input to parse-failure with idle cleanup', async () => {
    const { result } = renderHook(() => useImport());
    await act(async () => {
      await result.current.loadMarkdown('');
    });
    expect(result.current.state.kind).toBe('parse-failure');
    if (result.current.state.kind === 'parse-failure') {
      expect(result.current.state.originalMarkdown).toBe('');
      expect(result.current.state.cleanup).toEqual({ kind: 'idle' });
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
      result.current.confirmReplace({ observations: true });
    });
    expect(result.current.state.kind).toBe('preview');
    if (result.current.state.kind === 'preview') {
      expect(result.current.state.replaceSelection).toEqual({ observations: true });
    }
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
      result.current.confirmReplace({ observations: true });
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

describe('useImport AI cleanup flow (AI-09)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function enterParseFailure(markdown = '') {
    const hook = renderHook(() => useImport());
    await act(async () => {
      await hook.result.current.loadMarkdown(markdown);
    });
    expect(hook.result.current.state.kind).toBe('parse-failure');
    return hook;
  }

  it('requestAICleanup lands on profile-selection when cleaned markdown parses', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-test-key-xxxxxxxxx' });
    vi.spyOn(aiCallModule, 'aiStream').mockImplementation(async (opts) => {
      opts.onComplete(
        ['# Medizinisches Profil - Version 1.0', '', '## 1. Basisdaten', '- **Alter:** 40'].join(
          '\n',
        ),
      );
    });

    const { result } = await enterParseFailure('random broken paste');
    await act(async () => {
      await result.current.requestAICleanup();
    });

    expect(result.current.state.kind).toBe('profile-selection');
  });

  it('requestAICleanup sets impossible when the AI returns the sentinel', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-test-key-xxxxxxxxx' });
    vi.spyOn(aiCallModule, 'aiStream').mockImplementation(async (opts) => {
      opts.onComplete('NICHT_VERARBEITBAR');
    });

    const { result } = await enterParseFailure('garbled');
    await act(async () => {
      await result.current.requestAICleanup();
    });

    expect(result.current.state.kind).toBe('parse-failure');
    if (result.current.state.kind === 'parse-failure') {
      expect(result.current.state.cleanup.kind).toBe('impossible');
    }
  });

  it('requestAICleanup records the raw output when cleaned markdown still fails to parse', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-test-key-xxxxxxxxx' });
    vi.spyOn(aiCallModule, 'aiStream').mockImplementation(async (opts) => {
      // Non-sentinel response that also does not parse (no recognized sections).
      opts.onComplete('not a real profile, just prose that the parser ignores');
    });

    const { result } = await enterParseFailure('garbled');
    await act(async () => {
      await result.current.requestAICleanup();
    });

    expect(result.current.state.kind).toBe('parse-failure');
    if (result.current.state.kind === 'parse-failure') {
      expect(result.current.state.cleanup.kind).toBe('parse-failed-after-cleanup');
      if (result.current.state.cleanup.kind === 'parse-failed-after-cleanup') {
        expect(result.current.state.cleanup.rawCleaned).toContain('not a real profile');
      }
    }
  });

  it('requestAICleanup surfaces API errors via the cleanup sub-state', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-test-key-xxxxxxxxx' });
    vi.spyOn(aiCallModule, 'aiStream').mockImplementation(async (opts) => {
      opts.onError({ kind: 'rate-limit' });
    });

    const { result } = await enterParseFailure('garbled');
    await act(async () => {
      await result.current.requestAICleanup();
    });

    expect(result.current.state.kind).toBe('parse-failure');
    if (result.current.state.kind === 'parse-failure') {
      expect(result.current.state.cleanup).toEqual({
        kind: 'error',
        error: { kind: 'rate-limit' },
      });
    }
  });

  it('proceedWithPartial is a no-op on an empty parse result', async () => {
    const { result } = await enterParseFailure('');
    act(() => {
      result.current.proceedWithPartial();
    });
    expect(result.current.state.kind).toBe('parse-failure');
  });

  it('cancel from parse-failure returns to entry (clears cleanup state)', async () => {
    const { result } = await enterParseFailure('');
    act(() => {
      result.current.cancel();
    });
    expect(result.current.state.kind).toBe('entry');
  });
});
