import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  STORAGE_KEY,
  clearLanguagePreference,
  detectFromNavigator,
  detectInitialLanguage,
  hasLanguagePreference,
  readStoredLanguage,
  setLanguagePreference,
} from './detector';

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.removeItem(STORAGE_KEY);
});

function stubNavigatorLanguages(languages: string[] | undefined, language?: string) {
  vi.stubGlobal('navigator', { languages, language });
}

describe('readStoredLanguage', () => {
  it('returns "de" when storage is "de"', () => {
    localStorage.setItem(STORAGE_KEY, 'de');
    expect(readStoredLanguage()).toBe('de');
  });

  it('returns "en" when storage is "en"', () => {
    localStorage.setItem(STORAGE_KEY, 'en');
    expect(readStoredLanguage()).toBe('en');
  });

  it('returns null when storage is empty', () => {
    expect(readStoredLanguage()).toBeNull();
  });

  it('returns null for invalid stored values', () => {
    localStorage.setItem(STORAGE_KEY, 'fr');
    expect(readStoredLanguage()).toBeNull();
    localStorage.setItem(STORAGE_KEY, '');
    expect(readStoredLanguage()).toBeNull();
    localStorage.setItem(STORAGE_KEY, 'xx');
    expect(readStoredLanguage()).toBeNull();
  });

  it('returns null when localStorage throws (private-mode resilience)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode');
    });
    expect(readStoredLanguage()).toBeNull();
  });
});

describe('detectFromNavigator', () => {
  it('returns "de" for de-DE primary', () => {
    stubNavigatorLanguages(['de-DE'], 'de-DE');
    expect(detectFromNavigator()).toBe('de');
  });

  it('returns "de" for de-AT and de-CH regional variants', () => {
    stubNavigatorLanguages(['de-AT'], 'de-AT');
    expect(detectFromNavigator()).toBe('de');
    stubNavigatorLanguages(['de-CH'], 'de-CH');
    expect(detectFromNavigator()).toBe('de');
  });

  it('returns "de" for gsw-* (Swiss German)', () => {
    stubNavigatorLanguages(['gsw-CH'], 'gsw-CH');
    expect(detectFromNavigator()).toBe('de');
  });

  it('returns "en" for en-US primary', () => {
    stubNavigatorLanguages(['en-US'], 'en-US');
    expect(detectFromNavigator()).toBe('en');
  });

  it('returns "en" for non-DE locales (fr-FR)', () => {
    stubNavigatorLanguages(['fr-FR'], 'fr-FR');
    expect(detectFromNavigator()).toBe('en');
  });

  it('returns "en" when navigator.languages is empty', () => {
    stubNavigatorLanguages([], 'en');
    expect(detectFromNavigator()).toBe('en');
  });

  it('uses navigator.languages[0] when both are present (ignores secondaries)', () => {
    stubNavigatorLanguages(['fr-FR', 'de-DE'], 'fr-FR');
    expect(detectFromNavigator()).toBe('en');
  });
});

describe('detectInitialLanguage', () => {
  it('prefers stored "de" over navigator en-US', () => {
    localStorage.setItem(STORAGE_KEY, 'de');
    stubNavigatorLanguages(['en-US'], 'en-US');
    expect(detectInitialLanguage()).toBe('de');
  });

  it('prefers stored "en" over navigator de-DE', () => {
    localStorage.setItem(STORAGE_KEY, 'en');
    stubNavigatorLanguages(['de-DE'], 'de-DE');
    expect(detectInitialLanguage()).toBe('en');
  });

  it('falls through to navigator when no stored preference', () => {
    stubNavigatorLanguages(['de-DE'], 'de-DE');
    expect(detectInitialLanguage()).toBe('de');
    stubNavigatorLanguages(['en-US'], 'en-US');
    expect(detectInitialLanguage()).toBe('en');
  });
});

describe('setLanguagePreference + hasLanguagePreference', () => {
  it('setLanguagePreference("de") writes the key', () => {
    setLanguagePreference('de');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('de');
    expect(hasLanguagePreference()).toBe(true);
  });

  it('setLanguagePreference("en") overwrites any prior value', () => {
    localStorage.setItem(STORAGE_KEY, 'de');
    setLanguagePreference('en');
    expect(readStoredLanguage()).toBe('en');
  });

  it('clearLanguagePreference removes the key', () => {
    localStorage.setItem(STORAGE_KEY, 'de');
    expect(hasLanguagePreference()).toBe(true);
    clearLanguagePreference();
    expect(hasLanguagePreference()).toBe(false);
    expect(readStoredLanguage()).toBeNull();
  });
});
