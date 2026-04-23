import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePersistentStorage, __resetPersistentStorageSession } from './usePersistentStorage';

type StorageStub = {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
};

let originalStorage: StorageStub | undefined;

function setStorage(stub: StorageStub | undefined): void {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: stub,
  });
}

beforeEach(() => {
  __resetPersistentStorageSession();
  originalStorage = (navigator as unknown as { storage?: StorageStub }).storage;
});

afterEach(() => {
  setStorage(originalStorage);
});

describe('usePersistentStorage', () => {
  it('returns persisted when the browser reports storage is already persistent', async () => {
    setStorage({
      persisted: async () => true,
      persist: async () => true,
    });

    const { result } = renderHook(() => usePersistentStorage());

    await waitFor(() => expect(result.current.state.kind).toBe('persisted'));
  });

  it('returns transient when storage is not persistent and no request has been made', async () => {
    setStorage({
      persisted: async () => false,
      persist: async () => true,
    });

    const { result } = renderHook(() => usePersistentStorage());

    await waitFor(() => expect(result.current.state.kind).toBe('transient'));
  });

  it('returns unavailable when navigator.storage is missing', async () => {
    setStorage(undefined);

    const { result } = renderHook(() => usePersistentStorage());

    await waitFor(() => expect(result.current.state.kind).toBe('unavailable'));
  });

  it('returns unavailable when persisted() rejects', async () => {
    setStorage({
      persisted: async () => {
        throw new Error('boom');
      },
      persist: async () => true,
    });

    const { result } = renderHook(() => usePersistentStorage());

    await waitFor(() => expect(result.current.state.kind).toBe('unavailable'));
  });

  it('requestPersistence + versionKey re-probe transitions to persisted when granted', async () => {
    let persistedValue = false;
    const persistStub = vi.fn(async () => {
      persistedValue = true;
      return true;
    });
    setStorage({
      persisted: async () => persistedValue,
      persist: persistStub,
    });

    const { result, rerender } = renderHook(
      ({ v }: { v: number }) => usePersistentStorage({ versionKey: v }),
      { initialProps: { v: 0 } },
    );

    await waitFor(() => expect(result.current.state.kind).toBe('transient'));

    act(() => {
      result.current.requestPersistence();
    });

    // Let the fire-and-forget request resolve.
    await new Promise((r) => setTimeout(r, 10));

    rerender({ v: 1 });

    await waitFor(() => expect(result.current.state.kind).toBe('persisted'));
    expect(persistStub).toHaveBeenCalledTimes(1);
  });

  it('requestPersistence + versionKey re-probe transitions to denied when refused', async () => {
    const persistStub = vi.fn(async () => false);
    setStorage({
      persisted: async () => false,
      persist: persistStub,
    });

    const { result, rerender } = renderHook(
      ({ v }: { v: number }) => usePersistentStorage({ versionKey: v }),
      { initialProps: { v: 0 } },
    );

    await waitFor(() => expect(result.current.state.kind).toBe('transient'));

    act(() => {
      result.current.requestPersistence();
    });
    await new Promise((r) => setTimeout(r, 10));
    rerender({ v: 1 });

    await waitFor(() => expect(result.current.state.kind).toBe('denied'));
  });

  it('session guard prevents a second persist() call in the same page load', async () => {
    const persistStub = vi.fn(async () => false);
    setStorage({
      persisted: async () => false,
      persist: persistStub,
    });

    const { result } = renderHook(() => usePersistentStorage());
    await waitFor(() => expect(result.current.state.kind).toBe('transient'));

    act(() => result.current.requestPersistence());
    act(() => result.current.requestPersistence());
    act(() => result.current.requestPersistence());

    await new Promise((r) => setTimeout(r, 10));
    expect(persistStub).toHaveBeenCalledTimes(1);
  });

  it('requestPersistence is a no-op when the API is unavailable', async () => {
    setStorage(undefined);

    const { result } = renderHook(() => usePersistentStorage());
    await waitFor(() => expect(result.current.state.kind).toBe('unavailable'));

    expect(() => result.current.requestPersistence()).not.toThrow();
  });
});
