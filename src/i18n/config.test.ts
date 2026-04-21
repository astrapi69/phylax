import { describe, it, expect } from 'vitest';
import i18n, { NAMESPACES, SUPPORTED_LANGUAGES } from './config';

describe('i18n config', () => {
  it('initializes with a supported language selected', () => {
    expect(i18n.isInitialized).toBe(true);
    expect(SUPPORTED_LANGUAGES).toContain('de');
    expect(SUPPORTED_LANGUAGES).toContain('en');
    // After I18N-02-e, fallback is disabled. Missing keys surface as
    // raw keys rather than render the other language (which would read
    // as broken UX).
    expect(i18n.options.fallbackLng).toBe(false);
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

  it('initial language resolves to a supported language via detector', () => {
    // I18N-02-e replaced the DE hardcode with detectInitialLanguage().
    // The resolved value depends on stored preference + navigator state;
    // assert it is one of the supported languages rather than a literal.
    expect(i18n.options.lng).toBeDefined();
    expect(SUPPORTED_LANGUAGES).toContain(i18n.options.lng as string);
    expect(SUPPORTED_LANGUAGES).toContain(i18n.language);
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

  it('registers content EN namespaces after I18N-02-b', () => {
    const content = [
      'observations',
      'lab-values',
      'supplements',
      'open-points',
      'timeline',
      'profile-view',
      'profile-list',
      'profile-create',
      'export',
    ];
    for (const ns of content) {
      expect(i18n.hasResourceBundle('en', ns)).toBe(true);
    }
  });

  it('registers AI + support + import EN namespaces after I18N-02-c', () => {
    const added = ['ai-config', 'donation', 'import'];
    for (const ns of added) {
      expect(i18n.hasResourceBundle('en', ns)).toBe(true);
    }
  });

  it('registers ai-chat EN namespace after I18N-02-d', () => {
    expect(i18n.hasResourceBundle('en', 'ai-chat')).toBe(true);
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

describe('profile-list counts plural forms (I18N-02-b)', () => {
  const tDe = i18n.getFixedT('de', 'profile-list');
  const tEn = i18n.getFixedT('en', 'profile-list');

  it('open-points: count=1 renders singular in both languages', () => {
    expect(tDe('counts.open-points', { count: 1 })).toBe('1 offener Punkt');
    expect(tEn('counts.open-points', { count: 1 })).toBe('1 open point');
  });

  it('open-points: count=5 renders plural in both languages', () => {
    expect(tDe('counts.open-points', { count: 5 })).toBe('5 offene Punkte');
    expect(tEn('counts.open-points', { count: 5 })).toBe('5 open points');
  });

  it('versions: count=1 renders singular in both languages', () => {
    expect(tDe('counts.versions', { count: 1 })).toBe('1 Version');
    expect(tEn('counts.versions', { count: 1 })).toBe('1 version');
  });

  it('versions: count=5 renders plural in both languages', () => {
    expect(tDe('counts.versions', { count: 5 })).toBe('5 Versionen');
    expect(tEn('counts.versions', { count: 5 })).toBe('5 versions');
  });

  it('timeline-entries: count=1 renders singular in both languages', () => {
    expect(tDe('counts.timeline-entries', { count: 1 })).toBe('1 Verlaufsnotiz');
    expect(tEn('counts.timeline-entries', { count: 1 })).toBe('1 timeline entry');
  });

  it('timeline-entries: count=5 renders plural in both languages', () => {
    expect(tDe('counts.timeline-entries', { count: 5 })).toBe('5 Verlaufsnotizen');
    expect(tEn('counts.timeline-entries', { count: 5 })).toBe('5 timeline entries');
  });
});

describe('import plural forms (I18N-02-c)', () => {
  const tDe = i18n.getFixedT('de', 'import');
  const tEn = i18n.getFixedT('en', 'import');

  it('preview.warnings-summary: count=1 renders singular', () => {
    expect(tDe('preview.warnings-summary', { count: 1 })).toBe('1 Warnung beim Parsen');
    expect(tEn('preview.warnings-summary', { count: 1 })).toBe('1 warning during parsing');
  });

  it('preview.warnings-summary: count=5 renders plural', () => {
    expect(tDe('preview.warnings-summary', { count: 5 })).toBe('5 Warnungen beim Parsen');
    expect(tEn('preview.warnings-summary', { count: 5 })).toBe('5 warnings during parsing');
  });

  it('preview.unrecognized-summary: count=1 renders singular', () => {
    expect(tDe('preview.unrecognized-summary', { count: 1 })).toBe('1 nicht erkannter Block');
    expect(tEn('preview.unrecognized-summary', { count: 1 })).toBe('1 unrecognized block');
  });

  it('preview.unrecognized-summary: count=5 renders plural', () => {
    expect(tDe('preview.unrecognized-summary', { count: 5 })).toBe('5 nicht erkannte Bloecke');
    expect(tEn('preview.unrecognized-summary', { count: 5 })).toBe('5 unrecognized blocks');
  });

  it('confirm.lab-report-line: count=1 renders singular', () => {
    expect(tDe('confirm.lab-report-line', { count: 1, values: 3 })).toBe('1 Laborbefund (3 Werte)');
    expect(tEn('confirm.lab-report-line', { count: 1, values: 3 })).toBe('1 lab report (3 values)');
  });

  it('confirm.lab-report-line: count=5 renders plural', () => {
    expect(tDe('confirm.lab-report-line', { count: 5, values: 30 })).toBe(
      '5 Laborbefunde (30 Werte)',
    );
    expect(tEn('confirm.lab-report-line', { count: 5, values: 30 })).toBe(
      '5 lab reports (30 values)',
    );
  });

  it('counts.open-points: count=1 renders singular', () => {
    expect(tDe('counts.open-points', { count: 1 })).toBe('1 offener Punkt');
    expect(tEn('counts.open-points', { count: 1 })).toBe('1 open point');
  });

  it('counts.open-points: count=5 renders plural', () => {
    expect(tDe('counts.open-points', { count: 5 })).toBe('5 offene Punkte');
    expect(tEn('counts.open-points', { count: 5 })).toBe('5 open points');
  });

  it('counts.timeline-entries: count=1 renders singular', () => {
    expect(tDe('counts.timeline-entries', { count: 1 })).toBe('1 Verlaufsnotiz');
    expect(tEn('counts.timeline-entries', { count: 1 })).toBe('1 timeline entry');
  });

  it('counts.timeline-entries: count=5 renders plural', () => {
    expect(tDe('counts.timeline-entries', { count: 5 })).toBe('5 Verlaufsnotizen');
    expect(tEn('counts.timeline-entries', { count: 5 })).toBe('5 timeline entries');
  });

  it('counts.profile-versions: count=1 renders singular', () => {
    expect(tDe('counts.profile-versions', { count: 1 })).toBe('1 Profilversion');
    expect(tEn('counts.profile-versions', { count: 1 })).toBe('1 profile version');
  });

  it('counts.profile-versions: count=5 renders plural', () => {
    expect(tDe('counts.profile-versions', { count: 5 })).toBe('5 Profilversionen');
    expect(tEn('counts.profile-versions', { count: 5 })).toBe('5 profile versions');
  });

  it('counts.warnings: count=1 renders singular (renamed from warning-signs)', () => {
    expect(tDe('counts.warnings', { count: 1 })).toBe('1 Warnhinweis');
    expect(tEn('counts.warnings', { count: 1 })).toBe('1 warning');
  });

  it('counts.warnings: count=5 renders plural', () => {
    expect(tDe('counts.warnings', { count: 5 })).toBe('5 Warnhinweise');
    expect(tEn('counts.warnings', { count: 5 })).toBe('5 warnings');
  });

  it('counts.external-references: count=1 renders singular', () => {
    expect(tDe('counts.external-references', { count: 1 })).toBe('1 externe Referenz');
    expect(tEn('counts.external-references', { count: 1 })).toBe('1 external reference');
  });

  it('counts.external-references: count=5 renders plural', () => {
    expect(tDe('counts.external-references', { count: 5 })).toBe('5 externe Referenzen');
    expect(tEn('counts.external-references', { count: 5 })).toBe('5 external references');
  });
});

describe('ai-chat plural forms (I18N-02-d)', () => {
  const tDe = i18n.getFixedT('de', 'ai-chat');
  const tEn = i18n.getFixedT('en', 'ai-chat');

  it('message.context.counts.abnormal-labs: count=1 renders singular', () => {
    expect(tDe('message.context.counts.abnormal-labs', { count: 1 })).toBe(
      '1 abweichender Laborwert',
    );
    expect(tEn('message.context.counts.abnormal-labs', { count: 1 })).toBe('1 abnormal lab value');
  });

  it('message.context.counts.abnormal-labs: count=5 renders plural', () => {
    expect(tDe('message.context.counts.abnormal-labs', { count: 5 })).toBe(
      '5 abweichende Laborwerte',
    );
    expect(tEn('message.context.counts.abnormal-labs', { count: 5 })).toBe('5 abnormal lab values');
  });

  it('message.context.counts.open-points: count=1 renders singular', () => {
    expect(tDe('message.context.counts.open-points', { count: 1 })).toBe('1 offener Punkt');
    expect(tEn('message.context.counts.open-points', { count: 1 })).toBe('1 open point');
  });

  it('message.context.counts.open-points: count=5 renders plural', () => {
    expect(tDe('message.context.counts.open-points', { count: 5 })).toBe('5 offene Punkte');
    expect(tEn('message.context.counts.open-points', { count: 5 })).toBe('5 open points');
  });

  it('message.context.counts.warning-signs: count=1 renders singular', () => {
    expect(tDe('message.context.counts.warning-signs', { count: 1 })).toBe('1 Warnsignal');
    expect(tEn('message.context.counts.warning-signs', { count: 1 })).toBe('1 warning sign');
  });

  it('message.context.counts.warning-signs: count=5 renders plural', () => {
    expect(tDe('message.context.counts.warning-signs', { count: 5 })).toBe('5 Warnsignale');
    expect(tEn('message.context.counts.warning-signs', { count: 5 })).toBe('5 warning signs');
  });
});
