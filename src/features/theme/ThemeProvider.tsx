import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  getStoredTheme,
  resolveTheme,
  setStoredTheme,
  type ResolvedTheme,
  type Theme,
} from './themeStorage';

export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_MEDIA = '(prefers-color-scheme: dark)';

function applyDarkClass(resolved: ResolvedTheme): void {
  const html = document.documentElement;
  if (resolved === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}

/**
 * Owns the theme state, reflects it on `<html>` via the `dark` class, and
 * keeps `auto` mode in sync with the system preference via matchMedia.
 *
 * The initial render does NOT cause a flash: an inline script in `index.html`
 * has already applied the correct class before React mounted. This provider
 * synchronizes React's view of the world with what the script already did
 * and handles subsequent user-initiated changes.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme() ?? 'auto');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getStoredTheme() ?? 'auto'),
  );

  const mediaRef = useRef<MediaQueryList | null>(null);

  // Apply the class on mount, and whenever the user changes the explicit theme.
  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyDarkClass(resolved);
  }, [theme]);

  // In `auto` mode, follow the system preference reactively.
  useEffect(() => {
    if (theme !== 'auto') return;
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia(DARK_MEDIA);
    } catch {
      return;
    }
    mediaRef.current = mql;

    const handler = (e: MediaQueryListEvent) => {
      const next: ResolvedTheme = e.matches ? 'dark' : 'light';
      setResolvedTheme(next);
      applyDarkClass(next);
    };
    mql.addEventListener('change', handler);
    return () => {
      mql.removeEventListener('change', handler);
      mediaRef.current = null;
    };
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setStoredTheme(next);
    setThemeState(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
