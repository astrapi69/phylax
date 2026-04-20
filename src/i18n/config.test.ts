import { describe, it, expect } from 'vitest';
import i18n, { NAMESPACES, SUPPORTED_LANGUAGES } from './config';

describe('i18n config', () => {
  it('initializes with German as the active language', () => {
    expect(i18n.isInitialized).toBe(true);
    expect(SUPPORTED_LANGUAGES).toContain('de');
    // Fallback guarantees German even when the browser reports a language
    // that is not in SUPPORTED_LANGUAGES.
    expect(i18n.options.fallbackLng).toEqual(['de']);
  });

  it('registers every namespace declared in NAMESPACES', () => {
    for (const ns of NAMESPACES) {
      expect(i18n.hasResourceBundle('de', ns)).toBe(true);
    }
  });

  it('NAMESPACES length matches the declared count (23 feature-aligned namespaces)', () => {
    // 22 feature folders + `errors` catch-all. I18N-01l-b added `app-shell`,
    // `theme`, `pwa-update`, `documents`, `not-found`.
    // Update this assertion if the namespace list changes.
    expect(NAMESPACES).toHaveLength(23);
  });

  it('defaultNS is common', () => {
    expect(i18n.options.defaultNS).toBe('common');
  });

  it('disables React Suspense because resources load synchronously', () => {
    const react = i18n.options.react;
    expect(react?.useSuspense).toBe(false);
  });

  it('hardcodes German as the initial language while SUPPORTED_LANGUAGES has one entry', () => {
    // I18N-01 ships German only. When I18N-02 adds English, the
    // browser-languagedetector plugin is added back and this test flips
    // to asserting the detection chain. Keeping `lng: "de"` skips the
    // ~5 KB detector until it is useful.
    expect(i18n.options.lng).toBe('de');
    expect(i18n.language).toBe('de');
  });
});
