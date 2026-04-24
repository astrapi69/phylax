import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useResetAllData, DEXIE_DB_NAME } from './useResetAllData';

const ORIGINAL_LOCATION = window.location;

interface FakeDeleteRequest {
  onsuccess: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onblocked: ((ev: Event) => void) | null;
  error: DOMException | null;
}

let originalDeleteDatabase: typeof indexedDB.deleteDatabase;

function installDeleteDbStub(behavior: 'success' | 'error' | 'blocked'): {
  spy: ReturnType<typeof vi.fn>;
} {
  const request: FakeDeleteRequest = {
    onsuccess: null,
    onerror: null,
    onblocked: null,
    error: null,
  };

  const spy = vi.fn(() => request);
  // Cast at the assignment boundary — the test stub does not need to
  // implement the full `IDBOpenDBRequest` surface (EventTarget + many
  // unused fields); the orchestrator only consumes onsuccess /
  // onerror / onblocked / error.
  indexedDB.deleteDatabase = spy as unknown as typeof indexedDB.deleteDatabase;

  setTimeout(() => {
    if (behavior === 'success' && request.onsuccess) request.onsuccess({} as Event);
    if (behavior === 'error') {
      request.error = new DOMException('forced');
      if (request.onerror) request.onerror({} as Event);
    }
    if (behavior === 'blocked' && request.onblocked) request.onblocked({} as Event);
  }, 0);

  return { spy };
}

function stubLocation(): { replace: ReturnType<typeof vi.fn> } {
  const replace = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, replace },
  });
  return { replace };
}

beforeEach(() => {
  originalDeleteDatabase = indexedDB.deleteDatabase;
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  indexedDB.deleteDatabase = originalDeleteDatabase;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: ORIGINAL_LOCATION,
  });
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('useResetAllData', () => {
  it('starts in idle state with no result', () => {
    const { result } = renderHook(() => useResetAllData());
    expect(result.current.step).toBe('idle');
    expect(result.current.inProgress).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.blocked).toBe(false);
  });

  it('completes the wipe sequence on the happy path and navigates via location.replace', async () => {
    installDeleteDbStub('success');
    const { replace } = stubLocation();

    const { result } = renderHook(() => useResetAllData());

    await act(async () => {
      await result.current.reset();
    });

    await waitFor(() => expect(result.current.step).toBe('done'));
    expect(result.current.result?.fullySucceeded).toBe(true);
    expect(result.current.result?.errors).toEqual([]);
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('calls indexedDB.deleteDatabase with the Phylax DB name', async () => {
    const { spy } = installDeleteDbStub('success');
    stubLocation();

    const { result } = renderHook(() => useResetAllData());
    await act(async () => {
      await result.current.reset();
    });

    expect(spy).toHaveBeenCalledWith(DEXIE_DB_NAME);
  });

  it('clears Phylax-prefixed localStorage keys and leaves unrelated keys untouched', async () => {
    installDeleteDbStub('success');
    stubLocation();

    window.localStorage.setItem('phylax-language', 'de');
    window.localStorage.setItem('phylax-theme', 'dark');
    window.localStorage.setItem('phylax.persistence.dismissed.profile-1', '1');
    window.localStorage.setItem('phylax-observations-sort', 'recent');
    window.localStorage.setItem('unrelated-other-app-key', 'keep-me');
    window.localStorage.setItem('shopping-list', 'milk');

    const { result } = renderHook(() => useResetAllData());
    await act(async () => {
      await result.current.reset();
    });

    expect(window.localStorage.getItem('phylax-language')).toBeNull();
    expect(window.localStorage.getItem('phylax-theme')).toBeNull();
    expect(window.localStorage.getItem('phylax.persistence.dismissed.profile-1')).toBeNull();
    expect(window.localStorage.getItem('phylax-observations-sort')).toBeNull();
    expect(window.localStorage.getItem('unrelated-other-app-key')).toBe('keep-me');
    expect(window.localStorage.getItem('shopping-list')).toBe('milk');
  });

  it('clears Phylax-prefixed sessionStorage keys (rate-limit) and leaves unrelated keys untouched', async () => {
    installDeleteDbStub('success');
    stubLocation();

    window.sessionStorage.setItem('phylax-unlock-rate-limit', '{"failed":3}');
    window.sessionStorage.setItem('phylax-backup-import-rate-limit', '{"failed":1}');
    window.sessionStorage.setItem('not-phylax-session-key', 'preserve');

    const { result } = renderHook(() => useResetAllData());
    await act(async () => {
      await result.current.reset();
    });

    expect(window.sessionStorage.getItem('phylax-unlock-rate-limit')).toBeNull();
    expect(window.sessionStorage.getItem('phylax-backup-import-rate-limit')).toBeNull();
    expect(window.sessionStorage.getItem('not-phylax-session-key')).toBe('preserve');
  });

  it('surfaces blocked flag when indexedDB.deleteDatabase fires onblocked', async () => {
    installDeleteDbStub('blocked');
    stubLocation();

    const { result } = renderHook(() => useResetAllData());
    await act(async () => {
      await result.current.reset();
    });

    await waitFor(() => expect(result.current.step).toBe('done'));
    expect(result.current.blocked).toBe(true);
  });

  it('logs deleting-db error into result.errors but continues subsequent steps', async () => {
    installDeleteDbStub('error');
    const { replace } = stubLocation();

    window.localStorage.setItem('phylax-theme', 'dark');

    const { result } = renderHook(() => useResetAllData());
    await act(async () => {
      await result.current.reset();
    });

    await waitFor(() => expect(result.current.step).toBe('done'));
    expect(result.current.result?.fullySucceeded).toBe(false);
    expect(result.current.result?.errors.length).toBeGreaterThan(0);
    expect(result.current.result?.errors[0]?.step).toBe('deleting-db');
    // Subsequent steps still ran: localStorage cleared, navigation fired.
    expect(window.localStorage.getItem('phylax-theme')).toBeNull();
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('handles caches API absence gracefully (jsdom default)', async () => {
    installDeleteDbStub('success');
    stubLocation();
    // jsdom does not implement caches; the hook must not throw.
    expect(typeof (globalThis as { caches?: unknown }).caches).toBe('undefined');

    const { result } = renderHook(() => useResetAllData());
    await act(async () => {
      await result.current.reset();
    });

    await waitFor(() => expect(result.current.step).toBe('done'));
    expect(result.current.result?.errors.some((e) => e.step === 'clearing-caches')).toBe(false);
  });
});
