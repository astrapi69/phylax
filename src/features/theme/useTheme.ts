import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from './ThemeProvider';

/**
 * Read and control the active theme. Must be called inside a
 * `<ThemeProvider>` - throws if no provider is in the tree so missing
 * setup fails loudly rather than silently rendering a stale theme.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside a <ThemeProvider>.');
  }
  return ctx;
}
