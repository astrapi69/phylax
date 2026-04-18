import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSortPreference } from './useSortPreference';

const KEY = 'phylax-observations-sort';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSortPreference', () => {
  it('returns "recent" by default when nothing is stored', () => {
    const { result } = renderHook(() => useSortPreference('observations'));
    expect(result.current[0]).toBe('recent');
  });

  it('reads an existing stored preference', () => {
    window.localStorage.setItem(KEY, 'alphabetical');
    const { result } = renderHook(() => useSortPreference('observations'));
    expect(result.current[0]).toBe('alphabetical');
  });

  it('ignores unrecognized stored values and uses the default', () => {
    window.localStorage.setItem(KEY, 'nonsense');
    const { result } = renderHook(() => useSortPreference('observations'));
    expect(result.current[0]).toBe('recent');
  });

  it('writes to localStorage when the setter is called', () => {
    const { result } = renderHook(() => useSortPreference('observations'));
    act(() => {
      result.current[1]('alphabetical');
    });
    expect(result.current[0]).toBe('alphabetical');
    expect(window.localStorage.getItem(KEY)).toBe('alphabetical');
  });

  it('respects a custom defaultMode when nothing is stored', () => {
    const { result } = renderHook(() => useSortPreference('observations', 'alphabetical'));
    expect(result.current[0]).toBe('alphabetical');
  });

  it('falls back gracefully when localStorage.getItem throws (private browsing)', () => {
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { result } = renderHook(() => useSortPreference('observations'));
    expect(result.current[0]).toBe('recent');
  });

  it('swallows localStorage.setItem errors (quota, private browsing)', () => {
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { result } = renderHook(() => useSortPreference('observations'));
    expect(() => {
      act(() => {
        result.current[1]('alphabetical');
      });
    }).not.toThrow();
    expect(result.current[0]).toBe('alphabetical');
  });

  it('scopes the stored key by viewKey so multiple views do not collide', () => {
    window.localStorage.setItem('phylax-supplements-sort', 'alphabetical');
    const { result } = renderHook(() => useSortPreference('observations'));
    // observations has no stored preference, so it still defaults
    expect(result.current[0]).toBe('recent');
  });
});
