import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isDisclaimerAccepted,
  setDisclaimerAccepted,
  clearDisclaimerAccepted,
  DISCLAIMER_STORAGE_KEY,
} from './disclaimerStorage';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('disclaimer storage', () => {
  it('returns false when nothing is stored', () => {
    expect(isDisclaimerAccepted()).toBe(false);
  });

  it('setDisclaimerAccepted then isDisclaimerAccepted returns true', () => {
    setDisclaimerAccepted();
    expect(isDisclaimerAccepted()).toBe(true);
    expect(window.localStorage.getItem(DISCLAIMER_STORAGE_KEY)).toBe('true');
  });

  it('clearDisclaimerAccepted removes the flag', () => {
    setDisclaimerAccepted();
    clearDisclaimerAccepted();
    expect(isDisclaimerAccepted()).toBe(false);
    expect(window.localStorage.getItem(DISCLAIMER_STORAGE_KEY)).toBeNull();
  });

  it('returns false when localStorage read throws', () => {
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('disabled');
    });
    expect(isDisclaimerAccepted()).toBe(false);
  });

  it('setDisclaimerAccepted swallows storage errors', () => {
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => setDisclaimerAccepted()).not.toThrow();
  });

  it('clearDisclaimerAccepted swallows storage errors', () => {
    vi.spyOn(window.localStorage.__proto__, 'removeItem').mockImplementation(() => {
      throw new Error('locked');
    });
    expect(() => clearDisclaimerAccepted()).not.toThrow();
  });
});
