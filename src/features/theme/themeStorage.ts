export type Theme = 'light' | 'dark' | 'auto';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'phylax-theme';

const VALID_THEMES: Theme[] = ['light', 'dark', 'auto'];

function isValidTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (VALID_THEMES as string[]).includes(value);
}

/**
 * Read the persisted theme preference, or null if none is set.
 * Returns null for unknown values so callers can treat them as "no preference"
 * and fall back to the default. Safe on browsers with localStorage disabled
 * (returns null instead of throwing).
 */
export function getStoredTheme(): Theme | null {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isValidTheme(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Persist the theme preference. Invalid values are silently ignored so the
 * storage stays in a known-good state even if a caller passes something odd
 * from user input.
 */
export function setStoredTheme(theme: Theme): void {
  if (!isValidTheme(theme)) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // private browsing, quota, etc. fall through silently.
  }
}

/**
 * Resolve an (optionally `auto`) theme to the concrete class that should be
 * applied to `<html>`. Reads the system preference via matchMedia.
 */
export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'auto') {
    return systemPrefersDark() ? 'dark' : 'light';
  }
  return theme;
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}
