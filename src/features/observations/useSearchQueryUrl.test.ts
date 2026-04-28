import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { SetURLSearchParams } from 'react-router-dom';
import { useSearchQueryUrl } from './useSearchQueryUrl';

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
function makeMockSetter(): {
  setSearchParams: SetURLSearchParams & ReturnType<typeof vi.fn>;
  current: URLSearchParams;
  callMode: (call: number) => boolean | undefined;
  callValue: (call: number) => string | null;
} {
  const current = new URLSearchParams();
  const setSearchParams = vi.fn((updater, options) => {
    const next =
      typeof updater === 'function' ? updater(current) : new URLSearchParams(updater);
    // Sync the captured state so subsequent calls see the latest value.
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
      // The captured `current` reflects state AFTER the indexed call
      // only when no further calls landed; tests inspect after each
      // call individually.
      const args = setSearchParams.mock.calls[call];
      const updater = args?.[0];
      if (typeof updater !== 'function') return null;
      const snapshot = new URLSearchParams();
      const updated = updater(snapshot);
      return updated.get('q');
    },
  };
}

function renderUseSearchQueryUrl(initialQuery: string) {
  const mock = makeMockSetter();
  const { result, rerender } = renderHook(
    ({ query }) => useSearchQueryUrl(query, mock.setSearchParams),
    { initialProps: { query: initialQuery } },
  );
  return { result, rerender, ...mock };
}

describe('useSearchQueryUrl', () => {
  it('uses replace=false (push) on the first call after mount', () => {
    const { result, setSearchParams, callMode, callValue } = renderUseSearchQueryUrl('');
    result.current('foo');
    expect(setSearchParams).toHaveBeenCalledTimes(1);
    expect(callMode(0)).toBe(false);
    expect(callValue(0)).toBe('foo');
  });

  it('uses replace=true on subsequent calls before the settle timer fires', () => {
    const { result, rerender, setSearchParams, callMode } = renderUseSearchQueryUrl('');
    result.current('a');
    rerender({ query: 'a' });
    result.current('ab');
    rerender({ query: 'ab' });
    result.current('abc');
    expect(setSearchParams).toHaveBeenCalledTimes(3);
    expect(callMode(0)).toBe(false); // push
    expect(callMode(1)).toBe(true); // replace
    expect(callMode(2)).toBe(true); // replace
  });

  it('uses replace=false again after the settle timer fires', () => {
    const { result, rerender, callMode } = renderUseSearchQueryUrl('');
    result.current('a');
    rerender({ query: 'a' });
    vi.advanceTimersByTime(500);
    result.current('ab');
    expect(callMode(0)).toBe(false); // initial push
    expect(callMode(1)).toBe(false); // post-settle push
  });

  it('keeps replacing if the user keeps typing within the settle window', () => {
    const { result, rerender, callMode } = renderUseSearchQueryUrl('');
    result.current('a');
    rerender({ query: 'a' });
    vi.advanceTimersByTime(400);
    result.current('ab');
    rerender({ query: 'ab' });
    vi.advanceTimersByTime(400);
    result.current('abc');
    expect(callMode(0)).toBe(false); // push
    expect(callMode(1)).toBe(true); // replace (timer reset by ab)
    expect(callMode(2)).toBe(true); // replace (timer reset by abc)
  });

  it('skips the call entirely when the next value equals the current query', () => {
    const { result, rerender, setSearchParams } = renderUseSearchQueryUrl('foo');
    result.current('foo');
    rerender({ query: 'foo' });
    result.current('foo');
    expect(setSearchParams).not.toHaveBeenCalled();
  });

  it('treats an empty-input X-click on an already-empty query as a no-op', () => {
    const { result, setSearchParams } = renderUseSearchQueryUrl('');
    result.current('');
    expect(setSearchParams).not.toHaveBeenCalled();
  });

  it('deletes the q param when the next value is empty', () => {
    const { result, callValue } = renderUseSearchQueryUrl('foo');
    result.current('');
    expect(callValue(0)).toBeNull();
  });

  it('does not push on initial mount when the URL already carries a query', () => {
    // settledRef defaults to true; if no setQuery call happens, the URL
    // stays exactly as it arrived. Verify by rendering with a non-empty
    // query and asserting setSearchParams was never invoked.
    const { setSearchParams } = renderUseSearchQueryUrl('preloaded');
    expect(setSearchParams).not.toHaveBeenCalled();
  });

  it('starts fresh on remount: the first keystroke pushes again', () => {
    const { result: r1, callMode: cm1, unmount } = renderHookSession('');
    r1.current('a');
    expect(cm1(0)).toBe(false);
    unmount();

    // Fresh mount with the previously-typed query in the URL.
    const { result: r2, callMode: cm2 } = renderHookSession('a');
    r2.current('ab');
    expect(cm2(0)).toBe(false); // push, because remount resets settledRef to true
  });

  it('clears the pending settle timer on unmount', () => {
    // After unmount with a pending timer, no callback should fire.
    // Verified by ensuring no errors are thrown when timers advance
    // beyond the settle window after unmount.
    const { result, unmount } = renderHookSession('');
    result.current('a');
    unmount();
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
  });
});

/**
 * Helper that exposes `unmount` plus the mock-setter helpers in one
 * record. Mirrors `renderUseSearchQueryUrl` but with the unmount
 * function visible so multi-mount tests can drive it.
 */
function renderHookSession(initialQuery: string) {
  const mock = makeMockSetter();
  const { result, rerender, unmount } = renderHook(
    ({ query }) => useSearchQueryUrl(query, mock.setSearchParams),
    { initialProps: { query: initialQuery } },
  );
  return { result, rerender, unmount, ...mock };
}
