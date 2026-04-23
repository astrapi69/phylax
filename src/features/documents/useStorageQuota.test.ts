import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useStorageQuota, __resetStorageQuotaWarn } from './useStorageQuota';

type StorageWithEstimate = {
  estimate: () => Promise<{ usage?: number; quota?: number }>;
};

let originalStorage: StorageWithEstimate | undefined;
let warnSpy: ReturnType<typeof vi.spyOn>;

function setStorage(stub: StorageWithEstimate | undefined): void {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: stub,
  });
}

beforeEach(() => {
  __resetStorageQuotaWarn();
  originalStorage = (navigator as unknown as { storage?: StorageWithEstimate }).storage;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  setStorage(originalStorage);
  warnSpy.mockRestore();
});

describe('useStorageQuota', () => {
  it('returns loaded state with computed percent on a successful estimate', async () => {
    setStorage({
      estimate: async () => ({ usage: 25 * 1024 * 1024, quota: 100 * 1024 * 1024 }),
    });

    const { result } = renderHook(() => useStorageQuota());

    await waitFor(() => expect(result.current.kind).toBe('loaded'));
    if (result.current.kind !== 'loaded') throw new Error('unreachable');
    expect(result.current.usageBytes).toBe(25 * 1024 * 1024);
    expect(result.current.quotaBytes).toBe(100 * 1024 * 1024);
    expect(result.current.percent).toBe(25);
  });

  it('returns unavailable when navigator.storage is missing', async () => {
    setStorage(undefined);

    const { result } = renderHook(() => useStorageQuota());

    await waitFor(() => expect(result.current.kind).toBe('unavailable'));
  });

  it('returns error when estimate rejects', async () => {
    setStorage({
      estimate: async () => {
        throw new Error('boom');
      },
    });

    const { result } = renderHook(() => useStorageQuota());

    await waitFor(() => expect(result.current.kind).toBe('error'));
    if (result.current.kind !== 'error') throw new Error('unreachable');
    expect(result.current.detail).toBe('boom');
  });

  it('handles zero-quota edge case without NaN', async () => {
    setStorage({
      estimate: async () => ({ usage: 12345, quota: 0 }),
    });

    const { result } = renderHook(() => useStorageQuota());

    await waitFor(() => expect(result.current.kind).toBe('loaded'));
    if (result.current.kind !== 'loaded') throw new Error('unreachable');
    expect(result.current.percent).toBe(0);
  });

  it('floors near-full percent to 99 until truly at 100', async () => {
    // 99.7% raw -> Math.floor = 99, then min(99, 99) = 99.
    setStorage({
      estimate: async () => ({ usage: 997, quota: 1000 }),
    });

    const { result } = renderHook(() => useStorageQuota());

    await waitFor(() => expect(result.current.kind).toBe('loaded'));
    if (result.current.kind !== 'loaded') throw new Error('unreachable');
    expect(result.current.percent).toBe(99);
  });

  it('refetches when versionKey changes', async () => {
    const usages = [100, 200];
    let call = 0;
    setStorage({
      estimate: async () => ({ usage: usages[call++] ?? 0, quota: 1000 }),
    });

    const { result, rerender } = renderHook(
      ({ v }: { v: number }) => useStorageQuota({ versionKey: v }),
      { initialProps: { v: 0 } },
    );

    await waitFor(() => {
      if (result.current.kind !== 'loaded') return;
      expect(result.current.usageBytes).toBe(100);
    });

    rerender({ v: 1 });

    await waitFor(() => {
      if (result.current.kind !== 'loaded') return;
      expect(result.current.usageBytes).toBe(200);
    });
  });

  it('console.warn fires exactly once across multiple unavailable mounts', async () => {
    setStorage(undefined);

    const a = renderHook(() => useStorageQuota());
    await waitFor(() => expect(a.result.current.kind).toBe('unavailable'));
    a.unmount();

    const b = renderHook(() => useStorageQuota());
    await waitFor(() => expect(b.result.current.kind).toBe('unavailable'));
    b.unmount();

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
