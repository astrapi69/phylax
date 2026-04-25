import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBodyScrollLock, __resetForTest } from './useBodyScrollLock';

beforeEach(() => {
  __resetForTest();
});

afterEach(() => {
  __resetForTest();
});

describe('useBodyScrollLock', () => {
  it('sets body overflow hidden when first instance mounts', () => {
    const { unmount } = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
  });

  it('restores body overflow when last instance unmounts', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('counter shared across instances: pop 1 of 2 keeps lock', () => {
    const { unmount: unmount1 } = renderHook(() => useBodyScrollLock(true));
    const { unmount: unmount2 } = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
    unmount1();
    expect(document.body.style.overflow).toBe('hidden');
    unmount2();
    expect(document.body.style.overflow).toBe('');
  });

  it('no-ops when enabled is false', () => {
    document.body.style.overflow = 'auto';
    const { unmount } = renderHook(() => useBodyScrollLock(false));
    expect(document.body.style.overflow).toBe('auto');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('preserves prior overflow value across lock/unlock cycle', () => {
    document.body.style.overflow = 'scroll';
    const { unmount: u1 } = renderHook(() => useBodyScrollLock(true));
    u1();
    const { unmount: u2 } = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
    u2();
    expect(document.body.style.overflow).toBe('scroll');
  });
});
