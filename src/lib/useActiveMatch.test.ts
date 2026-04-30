import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActiveMatch } from './useActiveMatch';

describe('useActiveMatch', () => {
  it('returns activeIndex 0 when totalCount is 0', () => {
    const { result } = renderHook(() => useActiveMatch('foo', 0));
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.scrollSignal).toBe(0);
  });

  it('returns activeIndex 1 when totalCount is non-zero', () => {
    const { result } = renderHook(() => useActiveMatch('foo', 5));
    expect(result.current.activeIndex).toBe(1);
  });

  it('next advances activeIndex and increments scrollSignal', () => {
    const { result } = renderHook(() => useActiveMatch('foo', 3));
    expect(result.current.activeIndex).toBe(1);
    act(() => result.current.next());
    expect(result.current.activeIndex).toBe(2);
    expect(result.current.scrollSignal).toBe(1);
    act(() => result.current.next());
    expect(result.current.activeIndex).toBe(3);
    expect(result.current.scrollSignal).toBe(2);
  });

  it('next wraps from last to first', () => {
    const { result } = renderHook(() => useActiveMatch('foo', 3));
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.activeIndex).toBe(3);
    act(() => result.current.next());
    expect(result.current.activeIndex).toBe(1);
  });

  it('prev wraps from first to last', () => {
    const { result } = renderHook(() => useActiveMatch('foo', 3));
    expect(result.current.activeIndex).toBe(1);
    act(() => result.current.prev());
    expect(result.current.activeIndex).toBe(3);
  });

  it('prev decrements activeIndex and increments scrollSignal', () => {
    const { result } = renderHook(() => useActiveMatch('foo', 3));
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.activeIndex).toBe(3);
    act(() => result.current.prev());
    expect(result.current.activeIndex).toBe(2);
    expect(result.current.scrollSignal).toBe(3);
  });

  it('next is a no-op when totalCount is 0', () => {
    const { result } = renderHook(() => useActiveMatch('foo', 0));
    act(() => result.current.next());
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.scrollSignal).toBe(0);
  });

  it('resets activeIndex to 1 when query changes', () => {
    const { result, rerender } = renderHook(
      ({ q, n }) => useActiveMatch(q, n),
      { initialProps: { q: 'foo', n: 5 } },
    );
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.activeIndex).toBe(3);
    rerender({ q: 'bar', n: 5 });
    expect(result.current.activeIndex).toBe(1);
  });

  it('resets activeIndex to 1 when totalCount changes', () => {
    const { result, rerender } = renderHook(
      ({ q, n }) => useActiveMatch(q, n),
      { initialProps: { q: 'foo', n: 10 } },
    );
    act(() => result.current.next());
    act(() => result.current.next());
    rerender({ q: 'foo', n: 4 });
    expect(result.current.activeIndex).toBe(1);
  });

  it('reset on query change does NOT increment scrollSignal', () => {
    const { result, rerender } = renderHook(
      ({ q, n }) => useActiveMatch(q, n),
      { initialProps: { q: 'foo', n: 5 } },
    );
    act(() => result.current.next());
    const signalBefore = result.current.scrollSignal;
    rerender({ q: 'bar', n: 5 });
    expect(result.current.scrollSignal).toBe(signalBefore);
  });

  it('total drops to 0 makes activeIndex 0', () => {
    const { result, rerender } = renderHook(
      ({ q, n }) => useActiveMatch(q, n),
      { initialProps: { q: 'foo', n: 3 } },
    );
    expect(result.current.activeIndex).toBe(1);
    rerender({ q: 'foo', n: 0 });
    expect(result.current.activeIndex).toBe(0);
  });
});
