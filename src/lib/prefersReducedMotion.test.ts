import { describe, it, expect, vi, afterEach } from 'vitest';
import { prefersReducedMotion, preferredScrollBehavior } from './prefersReducedMotion';

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

function stubMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('prefersReducedMotion', () => {
  it('returns false when matchMedia reports no match', () => {
    stubMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  it('returns true when matchMedia reports a match', () => {
    stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
  });

  it('queries the prefers-reduced-motion media feature', () => {
    const spy = vi.fn().mockReturnValue({ matches: false });
    window.matchMedia = spy as unknown as typeof window.matchMedia;
    prefersReducedMotion();
    expect(spy).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });
});

describe('preferredScrollBehavior', () => {
  it('returns smooth by default', () => {
    stubMatchMedia(false);
    expect(preferredScrollBehavior()).toBe('smooth');
  });

  it('returns auto when reduced motion is requested', () => {
    stubMatchMedia(true);
    expect(preferredScrollBehavior()).toBe('auto');
  });
});
