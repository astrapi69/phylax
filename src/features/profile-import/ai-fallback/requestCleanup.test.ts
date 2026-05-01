import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../../crypto';
import { setupCompletedOnboarding } from '../../../db/test-helpers';
import { readMeta } from '../../../db/meta';
import { saveAIConfig, deleteAIConfig } from '../../../db/aiConfig';
import * as aiCallModule from '../../ai/aiCall';
import type { AiStreamOptions } from '../../ai/aiCall';
import { requestCleanup } from './requestCleanup';
import { CLEANUP_SYSTEM_PROMPT } from './cleanupPrompt';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

let lastCall: AiStreamOptions | null = null;

beforeEach(async () => {
  lastCall = null;
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestCleanup', () => {
  it('returns not-configured when no AI config is stored', async () => {
    const spy = vi.spyOn(aiCallModule, 'aiStream');
    const result = await requestCleanup('### [Thema] irgendwas');
    expect(result).toEqual({ kind: 'not-configured' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('sends the user markdown as the user message and uses the cleanup system prompt', async () => {
    await saveAIConfig({
      provider: 'anthropic',
      apiKey: 'sk-ant-test-key-xxxxxxxxx',
      model: 'claude-sonnet-4-6',
    });
    vi.spyOn(aiCallModule, 'aiStream').mockImplementation(async (opts) => {
      lastCall = opts;
      opts.onComplete('### Knie\n- Status: Akut');
    });

    const result = await requestCleanup('knie schmerzt seit 3 wochen');

    expect(result).toEqual({ kind: 'ok', cleaned: '### Knie\n- Status: Akut' });
    expect(lastCall?.system).toBe(CLEANUP_SYSTEM_PROMPT);
    expect(lastCall?.messages).toEqual([{ role: 'user', content: 'knie schmerzt seit 3 wochen' }]);
    expect(lastCall?.config.apiKey).toBe('sk-ant-test-key-xxxxxxxxx');
  });

  it('returns impossible when the AI response matches the sentinel', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-test-key-xxxxxxxxx' });
    vi.spyOn(aiCallModule, 'aiStream').mockImplementation(async (opts) => {
      opts.onComplete('NICHT_VERARBEITBAR');
    });

    const result = await requestCleanup('Lorem ipsum dolor sit amet');
    expect(result).toEqual({ kind: 'impossible' });
  });

  it('recognizes fuzzy sentinel variants (e.g. spaced, lowercase)', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-test-key-xxxxxxxxx' });
    vi.spyOn(aiCallModule, 'aiStream').mockImplementation(async (opts) => {
      opts.onComplete('Das ist leider NICHT VERARBEITBAR.');
    });

    const result = await requestCleanup('garbage');
    expect(result).toEqual({ kind: 'impossible' });
  });

  it('returns error when streamCompletion reports an auth failure', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-test-key-xxxxxxxxx' });
    vi.spyOn(aiCallModule, 'aiStream').mockImplementation(async (opts) => {
      opts.onError({ kind: 'auth' });
    });

    const result = await requestCleanup('### Something');
    expect(result).toEqual({ kind: 'error', error: { kind: 'auth' } });
  });

  it('trims surrounding whitespace from the cleaned response', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-test-key-xxxxxxxxx' });
    vi.spyOn(aiCallModule, 'aiStream').mockImplementation(async (opts) => {
      opts.onComplete('\n\n### Knie\n- Status: Akut\n\n');
    });

    const result = await requestCleanup('knie schmerzt');
    expect(result).toEqual({ kind: 'ok', cleaned: '### Knie\n- Status: Akut' });
  });

  it('forwards the abort signal to streamCompletion', async () => {
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-test-key-xxxxxxxxx' });
    const controller = new AbortController();
    vi.spyOn(aiCallModule, 'aiStream').mockImplementation(async (opts) => {
      lastCall = opts;
      opts.onComplete('### ok');
    });

    await requestCleanup('x', { signal: controller.signal });
    expect(lastCall?.signal).toBe(controller.signal);
  });

  it('leaves the database untouched between a not-configured and a configured call', async () => {
    // Regression guard: readAIConfig must not have side effects.
    expect((await requestCleanup('x')).kind).toBe('not-configured');
    await saveAIConfig({ provider: 'anthropic', apiKey: 'sk-ant-test-key-xxxxxxxxx' });
    vi.spyOn(aiCallModule, 'aiStream').mockImplementation(async (opts) => {
      opts.onComplete('### Knie\n- Status: ok');
    });
    const result = await requestCleanup('x');
    expect(result.kind).toBe('ok');
    await deleteAIConfig();
  });
});
