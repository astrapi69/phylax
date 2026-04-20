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

  it('NAMESPACES length matches the declared count (24 feature-aligned namespaces)', () => {
    // 23 feature folders + `errors` catch-all. I18N-01l-b added `app-shell`,
    // `theme`, `pwa-update`, `documents`, `not-found`. ONB-01e added
    // `backup-import`. Update this assertion if the namespace list changes.
    expect(NAMESPACES).toHaveLength(24);
  });

  it('defaultNS is common', () => {
    expect(i18n.options.defaultNS).toBe('common');
  });

  it('disables React Suspense because resources load synchronously', () => {
    const react = i18n.options.react;
    expect(react?.useSuspense).toBe(false);
  });

  it('hardcodes German as the initial language until I18N-02-e activates detection', () => {
    // I18N-02-a through 02-d ship EN translations under the existing
    // DE-active config. Detector + LanguageSwitcher land in 02-e; this
    // test flips to asserting detection at that point.
    expect(i18n.options.lng).toBe('de');
    expect(i18n.language).toBe('de');
  });

  it('registers foundation EN namespaces after I18N-02-a', () => {
    // 02-a populates these 9. Remaining 10 namespaces fall back to DE
    // via i18next until later sub-commits fill them in.
    const foundation = [
      'common',
      'app-shell',
      'theme',
      'pwa-update',
      'not-found',
      'documents',
      'onboarding',
      'unlock',
      'settings',
    ];
    for (const ns of foundation) {
      expect(i18n.hasResourceBundle('en', ns)).toBe(true);
    }
  });
});

describe('common counts plural forms', () => {
  const tDe = i18n.getFixedT('de', 'common');
  const tEn = i18n.getFixedT('en', 'common');

  it('observations: count=1 renders singular in both languages', () => {
    expect(tDe('counts.observations', { count: 1 })).toBe('1 Beobachtung');
    expect(tEn('counts.observations', { count: 1 })).toBe('1 observation');
  });

  it('observations: count=5 renders plural in both languages', () => {
    expect(tDe('counts.observations', { count: 5 })).toBe('5 Beobachtungen');
    expect(tEn('counts.observations', { count: 5 })).toBe('5 observations');
  });

  it('supplements: count=1 renders singular in both languages', () => {
    expect(tDe('counts.supplements', { count: 1 })).toBe('1 Supplement');
    expect(tEn('counts.supplements', { count: 1 })).toBe('1 supplement');
  });

  it('supplements: count=5 renders plural in both languages', () => {
    expect(tDe('counts.supplements', { count: 5 })).toBe('5 Supplemente');
    expect(tEn('counts.supplements', { count: 5 })).toBe('5 supplements');
  });
});
