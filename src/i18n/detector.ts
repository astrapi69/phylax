/**
 * Initial language resolver for Phylax.
 *
 * Consults in order:
 *   1. localStorage `phylax-language` (user's explicit preference set
 *      via Settings -> Language).
 *   2. `navigator.languages[0]` or `navigator.language` prefix.
 *   3. `'en'` as ultimate fallback (product's "English-by-default for
 *      non-DE browsers" stance).
 *
 * German prefix detection covers all `de-*` locale tags (de-DE, de-AT,
 * de-CH, ...) and `gsw-*` (Swiss German). Everything else maps to EN;
 * the user can still override via Settings.
 *
 * The `phylax-language` storage key is the single source of truth for
 * explicit user preference. `LanguageSection` writes it on Deutsch/
 * English and clears it on "Auto".
 *
 * Private-browsing resilience: all localStorage access is try/catch
 * wrapped. If localStorage throws (Safari private mode quota, storage
 * disabled by policy, SSR-like environment), the detector falls
 * through to the navigator-based path without crashing.
 */

import type { SupportedLanguage } from './config';

export const STORAGE_KEY = 'phylax-language';

const GERMAN_PREFIXES: ReadonlyArray<string> = ['de', 'gsw'];

/** Main resolver: storage preference > navigator-detected > 'en'. */
export function detectInitialLanguage(): SupportedLanguage {
  const stored = readStoredLanguage();
  if (stored !== null) return stored;
  return detectFromNavigator();
}

/**
 * Navigator-only detection. Exported so the LanguageSection's "Auto"
 * action can bypass the stored-preference path cleanly after the user
 * clears the preference.
 */
export function detectFromNavigator(): SupportedLanguage {
  const primary =
    (typeof navigator !== 'undefined'
      ? (navigator.languages?.[0] ?? navigator.language)
      : undefined) ?? 'en';
  const normalized = primary.toLowerCase();
  return GERMAN_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ? 'de' : 'en';
}

/** Read stored preference. Returns null if absent, invalid, or inaccessible. */
export function readStoredLanguage(): SupportedLanguage | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'de' || saved === 'en') return saved;
    return null;
  } catch {
    return null;
  }
}

export function setLanguagePreference(lang: SupportedLanguage): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* quota or private-browsing; preference does not persist */
  }
}

export function clearLanguagePreference(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasLanguagePreference(): boolean {
  return readStoredLanguage() !== null;
}
