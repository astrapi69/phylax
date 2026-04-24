import { describe, it, expect, vi } from 'vitest';
import {
  AiCallError,
  isRetryableAiCallError,
  mapChatErrorToAiCallError,
  withRetry,
} from './aiCallError';

describe('AiCallError', () => {
  it('carries kind + detail', () => {
    const err = new AiCallError('rate-limit', 'too many requests');
    expect(err.kind).toBe('rate-limit');
    expect(err.message).toBe('too many requests');
    expect(err.name).toBe('AiCallError');
  });

  it('defaults message to kind when no detail provided', () => {
    const err = new AiCallError('auth');
    expect(err.message).toBe('auth');
  });
});

describe('mapChatErrorToAiCallError', () => {
  it.each([
    ['network', 'network'],
    ['rate-limit', 'rate-limit'],
    ['auth', 'auth'],
    ['server', 'server'],
  ] as const)('maps %s ChatError to %s AiCallError', (chatKind, aiKind) => {
    const result = mapChatErrorToAiCallError({ kind: chatKind } as never);
    expect(result.kind).toBe(aiKind);
  });

  it('maps unknown ChatError to malformed-response with message', () => {
    const result = mapChatErrorToAiCallError({ kind: 'unknown', message: 'whatever' });
    expect(result.kind).toBe('malformed-response');
    expect(result.message).toBe('whatever');
  });
});

describe('isRetryableAiCallError', () => {
  it('returns true for network and rate-limit', () => {
    expect(isRetryableAiCallError(new AiCallError('network'))).toBe(true);
    expect(isRetryableAiCallError(new AiCallError('rate-limit'))).toBe(true);
  });

  it('returns false for auth, content-policy, server, malformed-response, ai-config-missing', () => {
    expect(isRetryableAiCallError(new AiCallError('auth'))).toBe(false);
    expect(isRetryableAiCallError(new AiCallError('content-policy'))).toBe(false);
    expect(isRetryableAiCallError(new AiCallError('server'))).toBe(false);
    expect(isRetryableAiCallError(new AiCallError('malformed-response'))).toBe(false);
    expect(isRetryableAiCallError(new AiCallError('ai-config-missing'))).toBe(false);
    expect(isRetryableAiCallError(new AiCallError('payload-too-large'))).toBe(false);
    expect(isRetryableAiCallError(new AiCallError('response-truncated'))).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns success on first attempt without delay', async () => {
    const fn = vi.fn(async () => 'ok');
    const delay = vi.fn(async () => undefined);
    const result = await withRetry(fn, { delay });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  it('retries network errors with backoff up to 3 attempts', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new AiCallError('network');
      return 'ok';
    });
    const delay = vi.fn(async () => undefined);
    const result = await withRetry(fn, { delay });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenNthCalledWith(1, 1000);
    expect(delay).toHaveBeenNthCalledWith(2, 2000);
  });

  it('retries rate-limit with exponential backoff', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new AiCallError('rate-limit');
      return 'ok';
    });
    const delay = vi.fn(async () => undefined);
    await withRetry(fn, { delay });
    expect(delay).toHaveBeenCalledWith(1000);
  });

  it('does not retry auth errors', async () => {
    const fn = vi.fn(async () => {
      throw new AiCallError('auth');
    });
    const delay = vi.fn(async () => undefined);
    await expect(withRetry(fn, { delay })).rejects.toBeInstanceOf(AiCallError);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  it('does not retry malformed-response', async () => {
    const fn = vi.fn(async () => {
      throw new AiCallError('malformed-response', 'bad json');
    });
    await expect(withRetry(fn, { delay: async () => undefined })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws AiCallError after exhausting retries on network errors', async () => {
    const fn = vi.fn(async () => {
      throw new AiCallError('network');
    });
    await expect(withRetry(fn, { delay: async () => undefined })).rejects.toMatchObject({
      kind: 'network',
    });
    expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  it('rethrows non-AiCallError errors immediately without retry', async () => {
    const fn = vi.fn(async () => {
      throw new Error('something else');
    });
    await expect(withRetry(fn, { delay: async () => undefined })).rejects.toThrow(/something else/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('honors AbortSignal between attempts', async () => {
    const controller = new AbortController();
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        controller.abort();
        throw new AiCallError('network');
      }
      return 'ok';
    });
    await expect(
      withRetry(fn, { delay: async () => undefined, signal: controller.signal }),
    ).rejects.toThrow(/aborted/);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
