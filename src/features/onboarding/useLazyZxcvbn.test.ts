import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLazyZxcvbn } from './useLazyZxcvbn';

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
});
