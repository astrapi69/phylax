import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getStoredTheme, setStoredTheme, resolveTheme, THEME_STORAGE_KEY } from './themeStorage';

beforeEach(() => {
  window.localStorage.clear();
});

describe('themeStorage', () => {
  it('getStoredTheme returns null when nothing is stored', () => {
    expect(getStoredTheme()).toBeNull();
  });

  it('getStoredTheme returns the stored valid value', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(getStoredTheme()).toBe('dark');
  });

  it('getStoredTheme returns null for invalid values', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(getStoredTheme()).toBeNull();
  });

  it('setStoredTheme writes to localStorage', () => {
    setStoredTheme('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('setStoredTheme silently ignores invalid values', () => {
    // @ts-expect-error - deliberately passing invalid input
    setStoredTheme('neon');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('getStoredTheme returns null when localStorage is disabled', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('disabled');
    });
    expect(getStoredTheme()).toBeNull();
    getItem.mockRestore();
  });

  it('resolveTheme returns the explicit value for light/dark', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('resolveTheme returns light when auto and system prefers light', () => {
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList);
    expect(resolveTheme('auto')).toBe('light');
    spy.mockRestore();
  });

  it('resolveTheme returns dark when auto and system prefers dark', () => {
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList);
    expect(resolveTheme('auto')).toBe('dark');
    spy.mockRestore();
  });
});
