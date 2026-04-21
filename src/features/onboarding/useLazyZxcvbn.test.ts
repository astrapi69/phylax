import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLazyZxcvbn, ZXCVBN_LOAD_TIMEOUT_MS, ZxcvbnLoadTimeoutError } from './useLazyZxcvbn';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useLazyZxcvbn', () => {
  it('starts not ready with no scorer', () => {
    const { result } = renderHook(() => useLazyZxcvbn());
    expect(result.current.ready).toBe(false);
    expect(result.current.score).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it('resolves to ready after loading the zxcvbn packs', async () => {
    const { result } = renderHook(() => useLazyZxcvbn());
    await waitFor(() => expect(result.current.ready).toBe(true), { timeout: 5000 });
    expect(typeof result.current.score).toBe('function');
  });

  it('returns a numeric 0-4 score for an arbitrary password', async () => {
    const { result } = renderHook(() => useLazyZxcvbn());
    await waitFor(() => expect(result.current.ready).toBe(true), { timeout: 5000 });
    const score = result.current.score?.('qwerty');
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(4);
  });

  it('rates "password" as weak (score <= 1)', async () => {
    const { result } = renderHook(() => useLazyZxcvbn());
    await waitFor(() => expect(result.current.ready).toBe(true), { timeout: 5000 });
    const score = result.current.score?.('password');
    expect(score).toBeLessThanOrEqual(1);
  });

  it('exports a 5-second timeout constant', () => {
    expect(ZXCVBN_LOAD_TIMEOUT_MS).toBe(5000);
  });

  it('ZxcvbnLoadTimeoutError carries the expected message and name', () => {
    const err = new ZxcvbnLoadTimeoutError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ZxcvbnLoadTimeoutError');
    expect(err.message).toBe('zxcvbn-load-timeout');
  });

  it('logs console.error on non-timeout dynamic-import rejection', async () => {
    vi.resetModules();
    const importError = new Error('module-load-failed');
    vi.doMock('@zxcvbn-ts/core', () => Promise.reject(importError));
    vi.doMock('@zxcvbn-ts/language-common', () => Promise.reject(importError));

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { useLazyZxcvbn: useLazyZxcvbnMocked } = await import('./useLazyZxcvbn');
    const { result } = renderHook(() => useLazyZxcvbnMocked());

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.ready).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0]?.[0]).toMatch(/failed to load zxcvbn-ts/);

    vi.doUnmock('@zxcvbn-ts/core');
    vi.doUnmock('@zxcvbn-ts/language-common');
  });

  it('logs a diagnostic warning and keeps ready=false on timeout', async () => {
    vi.resetModules();
    vi.doMock('@zxcvbn-ts/core', () => new Promise(() => {}));
    vi.doMock('@zxcvbn-ts/language-common', () => new Promise(() => {}));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.useFakeTimers();
    const { useLazyZxcvbn: useLazyZxcvbnMocked } = await import('./useLazyZxcvbn');
    const { result } = renderHook(() => useLazyZxcvbnMocked());

    expect(result.current.ready).toBe(false);

    await vi.advanceTimersByTimeAsync(5001);
    vi.useRealTimers();

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.ready).toBe(false);
    expect(result.current.score).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/timed out/);

    vi.doUnmock('@zxcvbn-ts/core');
    vi.doUnmock('@zxcvbn-ts/language-common');
  });
});
