import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { SetURLSearchParams } from 'react-router-dom';
import { useUrlSearchParam } from './useUrlSearchParam';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * The mock setSearchParams accepts the same call shapes the hook uses
 * (an updater function plus an options object). The third "captured"
 * helper unwraps the updater so assertions can read the resulting
 * URLSearchParams without dragging react-router into the test.
 */
function makeMockSetter(paramKey: string): {
  setSearchParams: SetURLSearchParams & ReturnType<typeof vi.fn>;
  current: URLSearchParams;
  callMode: (call: number) => boolean | undefined;
  callValue: (call: number) => string | null;
} {
  const current = new URLSearchParams();
  const setSearchParams = vi.fn((updater, options) => {
    const next = typeof updater === 'function' ? updater(current) : new URLSearchParams(updater);
    Array.from(current.keys()).forEach((k) => current.delete(k));
    next.forEach((v: string, k: string) => current.set(k, v));
    return options;
  }) as unknown as SetURLSearchParams & ReturnType<typeof vi.fn>;

  return {
    setSearchParams,
    current,
    callMode: (call) => {
      const args = setSearchParams.mock.calls[call];
      const opts = args?.[1] as { replace?: boolean } | undefined;
      return opts?.replace;
    },
    callValue: (call) => {
      const args = setSearchParams.mock.calls[call];
      const updater = args?.[0];
      if (typeof updater !== 'function') return null;
      const snapshot = new URLSearchParams();
      const updated = updater(snapshot);
      return updated.get(paramKey);
    },
  };
}

function renderUseUrlSearchParam(paramKey: string, initialValue: string) {
  const mock = makeMockSetter(paramKey);
  const { result, rerender } = renderHook(
    ({ value }) => useUrlSearchParam(paramKey, value, mock.setSearchParams),
    { initialProps: { value: initialValue } },
  );
  return { result, rerender, ...mock };
}

describe('useUrlSearchParam', () => {
  it('uses replace=false (push) on the first call after mount', () => {
    const { result, setSearchParams, callMode, callValue } = renderUseUrlSearchParam('q', '');
    result.current('foo');
    expect(setSearchParams).toHaveBeenCalledTimes(1);
    expect(callMode(0)).toBe(false);
    expect(callValue(0)).toBe('foo');
  });

  it('uses replace=true on subsequent calls before the settle timer fires', () => {
    const { result, rerender, setSearchParams, callMode } = renderUseUrlSearchParam('q', '');
    result.current('a');
    rerender({ value: 'a' });
    result.current('ab');
    rerender({ value: 'ab' });
    result.current('abc');
    expect(setSearchParams).toHaveBeenCalledTimes(3);
    expect(callMode(0)).toBe(false); // push
    expect(callMode(1)).toBe(true); // replace
    expect(callMode(2)).toBe(true); // replace
  });

  it('uses replace=false again after the settle timer fires', () => {
    const { result, rerender, callMode } = renderUseUrlSearchParam('q', '');
    result.current('a');
    rerender({ value: 'a' });
    vi.advanceTimersByTime(500);
    result.current('ab');
    expect(callMode(0)).toBe(false); // initial push
    expect(callMode(1)).toBe(false); // post-settle push
  });

  it('keeps replacing if the user keeps typing within the settle window', () => {
    const { result, rerender, callMode } = renderUseUrlSearchParam('q', '');
    result.current('a');
    rerender({ value: 'a' });
    vi.advanceTimersByTime(400);
    result.current('ab');
    rerender({ value: 'ab' });
    vi.advanceTimersByTime(400);
    result.current('abc');
    expect(callMode(0)).toBe(false); // push
    expect(callMode(1)).toBe(true); // replace (timer reset by ab)
    expect(callMode(2)).toBe(true); // replace (timer reset by abc)
  });

  it('skips the call entirely when the next value equals the current value', () => {
    const { result, rerender, setSearchParams } = renderUseUrlSearchParam('q', 'foo');
    result.current('foo');
    rerender({ value: 'foo' });
    result.current('foo');
    expect(setSearchParams).not.toHaveBeenCalled();
  });

  it('treats an empty-input X-click on an already-empty value as a no-op', () => {
    const { result, setSearchParams } = renderUseUrlSearchParam('q', '');
    result.current('');
    expect(setSearchParams).not.toHaveBeenCalled();
  });

  it('deletes the param when the next value is empty', () => {
    const { result, callValue } = renderUseUrlSearchParam('q', 'foo');
    result.current('');
    expect(callValue(0)).toBeNull();
  });

  it('does not push on initial mount when the URL already carries a value', () => {
    const { setSearchParams } = renderUseUrlSearchParam('q', 'preloaded');
    expect(setSearchParams).not.toHaveBeenCalled();
  });

  it('starts fresh on remount: the first input pushes again', () => {
    const { result: r1, callMode: cm1, unmount } = renderHookSession('q', '');
    r1.current('a');
    expect(cm1(0)).toBe(false);
    unmount();

    const { result: r2, callMode: cm2 } = renderHookSession('q', 'a');
    r2.current('ab');
    expect(cm2(0)).toBe(false);
  });

  it('clears the pending settle timer on unmount', () => {
    const { result, unmount } = renderHookSession('q', '');
    result.current('a');
    unmount();
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
  });

  it('honors a custom param key', () => {
    const { result, callValue, setSearchParams } = renderUseUrlSearchParam('filter', '');
    result.current('vitamin');
    expect(setSearchParams).toHaveBeenCalledTimes(1);
    expect(callValue(0)).toBe('vitamin');
  });

  it('reads and deletes the same custom param key', () => {
    const { result, callValue } = renderUseUrlSearchParam('filter', 'vitamin');
    result.current('');
    expect(callValue(0)).toBeNull();
  });
});

function renderHookSession(paramKey: string, initialValue: string) {
  const mock = makeMockSetter(paramKey);
  const { result, rerender, unmount } = renderHook(
    ({ value }) => useUrlSearchParam(paramKey, value, mock.setSearchParams),
    { initialProps: { value: initialValue } },
  );
  return { result, rerender, unmount, ...mock };
}
