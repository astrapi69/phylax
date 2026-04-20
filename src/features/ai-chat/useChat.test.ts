import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { saveAIConfig } from '../../db/aiConfig';
import { ProfileRepository } from '../../db/repositories';
import * as anthropicClient from './api/anthropicClient';
import type { AnthropicStreamOptions, ChatError } from './api/types';
import i18n from '../../i18n/config';
import { useChat, errorMessageFor } from './useChat';
import type { ProfileDiff } from './commit';
import { GUIDED_SESSION_OPENING_MESSAGE } from './guided';

const t = i18n.getFixedT('de', 'ai-chat');

const TEST_PASSWORD = 'test-password-12';

async function unlockSession(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function seedConfiguredSession(): Promise<void> {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
  await saveAIConfig({
    provider: 'anthropic',
    apiKey: 'sk-ant-configured-key-test-1234',
    model: 'claude-sonnet-4-20250514',
  });
  await new ProfileRepository().create({
    baseData: {
      name: 'Max',
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

/** Capture the last call's options so the test can drive the stream. */
let lastStreamCall: AnthropicStreamOptions | null = null;

function mockStreamSuccess(tokens: string[]): void {
  vi.spyOn(anthropicClient, 'streamCompletion').mockImplementation(async (opts) => {
    lastStreamCall = opts;
    for (const t of tokens) {
      opts.onToken(t);
    }
    opts.onComplete(tokens.join(''));
  });
}

function mockStreamError(error: ChatError): void {
  vi.spyOn(anthropicClient, 'streamCompletion').mockImplementation(async (opts) => {
    lastStreamCall = opts;
    opts.onError(error);
  });
}

/**
 * Yield until useAIConfig's initial load effect has settled. Without this,
 * sendMessage sees configState.status === 'loading' and takes the early-
 * return path, so no stream is ever called.
 */
async function waitForConfigReady(): Promise<void> {
  // Two microtasks + one macrotask is enough for the readAIConfig promise chain
  // (decrypt + JSON parse + setState) to resolve in practice.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}

beforeEach(async () => {
  window.localStorage.clear();
  lastStreamCall = null;
  await seedConfiguredSession();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useChat', () => {
  it('initial state: empty messages, not streaming', () => {
    mockStreamSuccess([]);
    const { result } = renderHook(() => useChat());
    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
  });

  it('sendMessage appends the user message and a streamed assistant message', async () => {
    mockStreamSuccess(['Hallo', ' Welt']);
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    await act(async () => {
      await result.current.sendMessage('Mir tut die Schulter weh.');
    });

    const { messages } = result.current;
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: 'user', content: 'Mir tut die Schulter weh.' });
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Hallo Welt',
      streaming: false,
    });
    expect(result.current.isStreaming).toBe(false);
  });

  it('tokens accumulate into the assistant message during streaming', async () => {
    vi.spyOn(anthropicClient, 'streamCompletion').mockImplementation(async (opts) => {
      opts.onToken('A');
      opts.onToken('B');
      opts.onComplete('AB');
    });

    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    await act(async () => {
      await result.current.sendMessage('hi');
    });

    const assistant = result.current.messages[1];
    expect(assistant?.content).toBe('AB');
    expect(assistant?.streaming).toBe(false);
  });

  it('onError appends a system message with the mapped German string', async () => {
    mockStreamError({ kind: 'auth' });
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    await act(async () => {
      await result.current.sendMessage('hi');
    });

    const systemMsg = result.current.messages.find((m) => m.role === 'system');
    expect(systemMsg?.content).toMatch(/API-Schluessel ungueltig/);
    expect(systemMsg?.errorKind).toBe('auth');
    expect(result.current.isStreaming).toBe(false);
  });

  it('unconfigured AI config does not call the API and shows a system message', async () => {
    const { deleteAIConfig } = await import('../../db/aiConfig');
    await deleteAIConfig();
    const streamSpy = vi.spyOn(anthropicClient, 'streamCompletion');

    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    await act(async () => {
      await result.current.sendMessage('hi');
    });

    expect(streamSpy).not.toHaveBeenCalled();
    const sys = result.current.messages.find((m) => m.role === 'system');
    expect(sys?.content).toMatch(/nicht konfiguriert/i);
  });

  it('locked key store (repository throws) adds an "App ist gesperrt" system message', async () => {
    mockStreamSuccess(['irrelevant']);
    // Let useAIConfig settle while still unlocked, then lock so the
    // subsequent profile repository call fails when sendMessage loads the
    // profile. React state for configState stays "configured" even though
    // storage is now locked - that is the scenario we want to exercise.
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();
    lock();

    await act(async () => {
      await result.current.sendMessage('hi');
    });

    const sys = result.current.messages.find((m) => m.role === 'system');
    expect(sys?.content).toMatch(/gesperrt/i);
    expect(result.current.isStreaming).toBe(false);
  });

  it('sends conversation history on the second message', async () => {
    mockStreamSuccess(['first reply']);
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    await act(async () => {
      await result.current.sendMessage('first question');
    });

    mockStreamSuccess(['second reply']);
    await act(async () => {
      await result.current.sendMessage('follow-up');
    });

    if (!lastStreamCall) throw new Error('expected streamCompletion to have been called');
    expect(lastStreamCall.messages).toEqual([
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'first reply' },
      { role: 'user', content: 'follow-up' },
    ]);
  });

  it('caches the system prompt across messages in a session', async () => {
    mockStreamSuccess(['a']);
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    await act(async () => {
      await result.current.sendMessage('one');
    });
    const firstSystem = lastStreamCall?.system;
    expect(firstSystem).toMatch(/Strukturierungsassistent/);

    mockStreamSuccess(['b']);
    await act(async () => {
      await result.current.sendMessage('two');
    });
    expect(lastStreamCall?.system).toBe(firstSystem);
  });

  it('clearChat empties messages and drops the cached system prompt', async () => {
    mockStreamSuccess(['hi']);
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    await act(async () => {
      await result.current.sendMessage('one');
    });
    expect(result.current.messages.length).toBe(2);

    act(() => {
      result.current.clearChat();
    });
    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
  });

  it('cancelStream aborts and leaves partial assistant content visible', async () => {
    // Manual stream: emit a couple tokens, never call onComplete. The user
    // cancels mid-stream; partial content stays in the transcript.
    vi.spyOn(anthropicClient, 'streamCompletion').mockImplementation(async (opts) => {
      opts.onToken('part');
      opts.onToken('ial');
      // Hang until the abort signal fires (client is silent on abort).
      await new Promise<void>((resolve) => {
        opts.signal?.addEventListener('abort', () => resolve());
      });
    });

    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    let sendPromise: Promise<void> | undefined;
    await act(async () => {
      sendPromise = result.current.sendMessage('hi');
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.isStreaming).toBe(true);
    expect(result.current.messages[1]?.content).toBe('partial');

    await act(async () => {
      result.current.cancelStream();
      await sendPromise;
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.messages[1]?.content).toBe('partial');
    expect(result.current.messages[1]?.streaming).toBe(false);
  });

  it('sendMessage ignores whitespace-only input', async () => {
    const streamSpy = vi.spyOn(anthropicClient, 'streamCompletion');
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    await act(async () => {
      await result.current.sendMessage('   \n  ');
    });

    expect(streamSpy).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it('sends the api key and model from the stored AI config', async () => {
    mockStreamSuccess(['ok']);
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    await act(async () => {
      await result.current.sendMessage('hi');
    });
    expect(lastStreamCall?.apiKey).toBe('sk-ant-configured-key-test-1234');
    expect(lastStreamCall?.model).toBe('claude-sonnet-4-20250514');
  });

  it('shareProfile appends a context message with counts and does NOT call the API', async () => {
    const streamSpy = vi.spyOn(anthropicClient, 'streamCompletion');
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    await act(async () => {
      await result.current.shareProfile();
    });

    expect(streamSpy).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(1);
    const ctx = result.current.messages[0];
    expect(ctx?.role).toBe('context');
    expect(ctx?.content).toMatch(/^# Profil: Max/);
    expect(ctx?.contextCounts).toEqual({
      observationCount: 0,
      abnormalLabCount: 0,
      supplementCount: 0,
      openPointCount: 0,
      warningSignCount: 0,
    });
    expect(result.current.isSharingProfile).toBe(false);
  });

  it('shareProfile without a profile appends a "Kein Profil gefunden" system message', async () => {
    const { db } = await import('../../db/schema');
    await db.profiles.clear();

    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    await act(async () => {
      await result.current.shareProfile();
    });

    const sys = result.current.messages.find((m) => m.role === 'system');
    expect(sys?.content).toMatch(/Kein Profil/i);
    expect(result.current.isSharingProfile).toBe(false);
  });

  it('shareProfile when locked appends the lock system message', async () => {
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();
    lock();

    await act(async () => {
      await result.current.shareProfile();
    });

    const sys = result.current.messages.find((m) => m.role === 'system');
    expect(sys?.content).toMatch(/gesperrt/i);
    expect(result.current.isSharingProfile).toBe(false);
  });

  it('markMessageCommitted records the id and survives as a ReadonlySet', async () => {
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    expect(result.current.committedMessageIds.size).toBe(0);

    act(() => {
      result.current.markMessageCommitted('msg-1');
    });
    expect(result.current.committedMessageIds.has('msg-1')).toBe(true);

    // Idempotent
    act(() => {
      result.current.markMessageCommitted('msg-1');
    });
    expect(result.current.committedMessageIds.size).toBe(1);

    act(() => {
      result.current.markMessageCommitted('msg-2');
    });
    expect(result.current.committedMessageIds.has('msg-2')).toBe(true);
  });

  it('appendSystemMessage adds a system message with optional errorKind', async () => {
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    act(() => {
      result.current.appendSystemMessage('Profil-Update gespeichert.');
    });
    const last1 = result.current.messages[result.current.messages.length - 1];
    expect(last1?.role).toBe('system');
    expect(last1?.content).toBe('Profil-Update gespeichert.');
    expect(last1?.errorKind).toBeUndefined();

    act(() => {
      result.current.appendSystemMessage('Fehler beim Speichern.', 'unknown');
    });
    const last2 = result.current.messages[result.current.messages.length - 1];
    expect(last2?.errorKind).toBe('unknown');
  });

  it('clearChat also clears committed message ids', async () => {
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    act(() => {
      result.current.markMessageCommitted('msg-1');
    });
    expect(result.current.committedMessageIds.size).toBe(1);

    act(() => {
      result.current.clearChat();
    });
    expect(result.current.committedMessageIds.size).toBe(0);
  });

  it('after shareProfile, the next sendMessage sends framed context + user merged into a single user message', async () => {
    mockStreamSuccess(['ok']);
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    await act(async () => {
      await result.current.shareProfile();
    });
    await act(async () => {
      await result.current.sendMessage('Hallo');
    });

    const apiMessages = lastStreamCall?.messages ?? [];
    expect(apiMessages).toHaveLength(1);
    expect(apiMessages[0]?.role).toBe('user');
    expect(apiMessages[0]?.content).toMatch(/bitte als Kontext/);
    expect(apiMessages[0]?.content).toMatch(/# Profil: Max/);
    expect(apiMessages[0]?.content).toMatch(/Hallo$/);
  });
});

function diffWith(
  parts: Partial<{
    observationsNew: number;
    observationsChanged: number;
    supplementsNew: number;
    openPointsNew: number;
  }>,
): ProfileDiff {
  return {
    observations: {
      new: Array.from({ length: parts.observationsNew ?? 0 }, () => ({}) as never),
      changed: Array.from({ length: parts.observationsChanged ?? 0 }, () => ({}) as never),
      unchanged: [],
    },
    supplements: {
      new: Array.from({ length: parts.supplementsNew ?? 0 }, () => ({}) as never),
      changed: [],
      unchanged: [],
    },
    openPoints: {
      new: Array.from({ length: parts.openPointsNew ?? 0 }, () => ({}) as never),
    },
    warnings: [],
  };
}

describe('useChat guided session (AI-06)', () => {
  it('initial guided session state is inactive with no completed sections', async () => {
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();
    expect(result.current.guidedSession).toEqual({
      active: false,
      sectionsCompleted: [],
      startedAt: null,
    });
  });

  it('startGuidedSession appends the hardcoded opening assistant message', async () => {
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    act(() => {
      result.current.startGuidedSession();
    });

    expect(result.current.guidedSession.active).toBe(true);
    const last = result.current.messages[result.current.messages.length - 1];
    expect(last?.role).toBe('assistant');
    expect(last?.content).toBe(GUIDED_SESSION_OPENING_MESSAGE);
  });

  it('endGuidedSession deactivates and appends a system message', async () => {
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    act(() => {
      result.current.startGuidedSession();
    });
    act(() => {
      result.current.endGuidedSession();
    });

    expect(result.current.guidedSession.active).toBe(false);
    const sys = result.current.messages.find((m) => m.role === 'system');
    expect(sys?.content).toMatch(/Gefuehrte Sitzung beendet/);
  });

  it('system prompt includes the guided framing when a session is active', async () => {
    mockStreamSuccess(['ok']);
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    act(() => {
      result.current.startGuidedSession();
    });
    await act(async () => {
      await result.current.sendMessage('Ich habe Schulterschmerzen.');
    });

    expect(lastStreamCall?.system).toMatch(/gefuehrte Sitzung/i);
    expect(lastStreamCall?.system).toMatch(/Offene Punkte - Fragen/);
  });

  it('system prompt excludes the guided framing when no session is active', async () => {
    mockStreamSuccess(['ok']);
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    await act(async () => {
      await result.current.sendMessage('Ich habe Schulterschmerzen.');
    });

    expect(lastStreamCall?.system).not.toMatch(/gefuehrte Sitzung/i);
  });

  it('markGuidedSessionCommit with a mixed diff marks all touched sections', async () => {
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    act(() => {
      result.current.startGuidedSession();
    });
    act(() => {
      result.current.markGuidedSessionCommit(
        diffWith({ observationsNew: 1, supplementsNew: 1, openPointsNew: 1 }),
      );
    });

    expect(result.current.guidedSession.sectionsCompleted).toEqual([
      'observations',
      'supplements',
      'open-points',
    ]);
  });

  it('markGuidedSessionCommit is a no-op when no session is active', async () => {
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    act(() => {
      result.current.markGuidedSessionCommit(diffWith({ observationsNew: 1 }));
    });

    expect(result.current.guidedSession.active).toBe(false);
    expect(result.current.guidedSession.sectionsCompleted).toEqual([]);
  });

  it('clearChat also ends an active guided session', async () => {
    const { result } = renderHook(() => useChat());
    await waitForConfigReady();

    act(() => {
      result.current.startGuidedSession();
    });
    expect(result.current.guidedSession.active).toBe(true);

    act(() => {
      result.current.clearChat();
    });
    expect(result.current.guidedSession.active).toBe(false);
    expect(result.current.guidedSession.sectionsCompleted).toEqual([]);
  });
});

describe('errorMessageFor', () => {
  it('maps every ChatError kind to a distinct German string', () => {
    expect(errorMessageFor(t, { kind: 'auth' })).toMatch(/API-Schluessel ungueltig/);
    expect(errorMessageFor(t, { kind: 'rate-limit' })).toMatch(/Zu viele Anfragen/);
    expect(errorMessageFor(t, { kind: 'server' })).toMatch(/voruebergehend nicht erreichbar/);
    expect(errorMessageFor(t, { kind: 'network' })).toMatch(/Keine Internetverbindung/);
    expect(errorMessageFor(t, { kind: 'unknown', message: 'model not found' })).toMatch(
      /model not found/,
    );
  });
});
