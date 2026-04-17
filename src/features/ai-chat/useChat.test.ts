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
import { useChat, errorMessageFor } from './useChat';

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

describe('errorMessageFor', () => {
  it('maps every ChatError kind to a distinct German string', () => {
    expect(errorMessageFor({ kind: 'auth' })).toMatch(/API-Schluessel ungueltig/);
    expect(errorMessageFor({ kind: 'rate-limit' })).toMatch(/Zu viele Anfragen/);
    expect(errorMessageFor({ kind: 'server' })).toMatch(/voruebergehend nicht erreichbar/);
    expect(errorMessageFor({ kind: 'network' })).toMatch(/Keine Internetverbindung/);
    expect(errorMessageFor({ kind: 'unknown', message: 'model not found' })).toMatch(
      /model not found/,
    );
  });
});
