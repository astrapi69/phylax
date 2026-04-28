import { describe, it, expect } from 'vitest';
import type {
  Profile,
  Observation,
  LabReport,
  LabValue,
  Supplement,
  OpenPoint,
  TimelineEntry,
} from '../../domain';
import { parseProfile } from '../profile-import/parser/parseProfile';
import { exportProfileAsMarkdown } from './markdownExport';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  const now = Date.UTC(2026, 3, 18);
  return {
    id: 'p1',
    profileId: 'p1',
    createdAt: now,
    updatedAt: now,
    baseData: {
      name: 'Max Mustermann',
      age: 42,
      heightCm: 180,
      weightKg: 78,
      weightHistory: [],
      knownDiagnoses: ['Hashimoto-Thyreoiditis', 'Migrane'],
      currentMedications: [],
      relevantLimitations: [],
      profileType: 'self',
    },
    warningSigns: ['Akute Brustschmerzen', 'Neurologische Ausfaelle'],
    externalReferences: [],
    version: '1.3.5',
    ...overrides,
  };
}

function makeObservation(theme: string, overrides: Partial<Observation> = {}): Observation {
  const now = Date.UTC(2026, 3, 1);
  return {
    id: `obs-${theme}`,
    profileId: 'p1',
    createdAt: now,
    updatedAt: now,
    theme,
    fact: 'Schmerzen nach Belastung',
    pattern: 'Belastungsabhaengig',
    selfRegulation: 'Pause, Waerme',
    status: 'Anhaltend',
    source: 'user',
    extraSections: {},
    ...overrides,
  };
}

describe('exportProfileAsMarkdown', () => {
  it('renders an empty profile with only basisdaten and no entity sections', () => {
    const profile = makeProfile();
    const md = exportProfileAsMarkdown(profile, [], [], [], [], [], []);
    expect(md).toContain('# Max Mustermann (Selbst)');
    expect(md).toContain('## 1. Basisdaten');
    expect(md).not.toContain('## 2. Relevante Vorgeschichte');
    expect(md).not.toContain('## 3. Blutwerte');
    expect(md).not.toContain('## 5. Verträglichkeiten');
    expect(md).not.toContain('## 11. Offene Punkte');
    expect(md).not.toContain('## 10. Verlaufsnotizen');
  });

  it('labels proxy profiles with the caregiver name in the top heading', () => {
    const profile = makeProfile({
      baseData: {
        ...makeProfile().baseData,
        profileType: 'proxy',
        name: 'Mutter',
        managedBy: 'Anna Mueller',
      },
    });
    const md = exportProfileAsMarkdown(profile, [], [], [], [], [], []);
    expect(md).toMatch(/^# Mutter \(Stellvertreter: betreut von Anna Mueller\)/);
  });

  it('groups observations by theme, sorted, with bold field labels', () => {
    const profile = makeProfile();
    const obs = [
      makeObservation('Schulter rechts'),
      makeObservation('Kopfschmerzen', {
        fact: 'Pulsierend rechts',
        pattern: 'Vor Wetterumschwung',
      }),
      makeObservation('Schulter rechts', {
        id: 'obs-2',
        fact: 'Morgenmal',
        pattern: 'Stress-Trigger',
      }),
    ];
    const md = exportProfileAsMarkdown(profile, obs, [], [], [], [], []);
    expect(md).toContain('## 2. Relevante Vorgeschichte');
    expect(md).toContain('### Kopfschmerzen');
    expect(md).toContain('### Schulter rechts');
    expect(md).toContain('- **Beobachtung:** Pulsierend rechts');
    expect(md).toContain('- **Muster:** Stress-Trigger');
    // Kopfschmerzen sorts before Schulter rechts alphabetically.
    const kIdx = md.indexOf('### Kopfschmerzen');
    const sIdx = md.indexOf('### Schulter rechts');
    expect(kIdx).toBeLessThan(sIdx);
  });

  it('emits lab values as tables grouped by category under per-report headings', () => {
    const profile = makeProfile();
    const report: LabReport = {
      id: 'r1',
      profileId: 'p1',
      createdAt: 0,
      updatedAt: 0,
      reportDate: '2025-10-15',
      labName: 'Synlab',
      categoryAssessments: {},
    };
    const values: LabValue[] = [
      {
        id: 'v1',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        reportId: 'r1',
        category: 'Schilddruese',
        parameter: 'TSH',
        result: '2.8',
        unit: 'mU/l',
        referenceRange: '0.4-4.0',
        assessment: 'normal',
      },
    ];
    const md = exportProfileAsMarkdown(profile, [], [report], values, [], [], []);
    expect(md).toContain('## 3. Blutwerte');
    expect(md).toContain('### Befund vom 15.10.2025');
    expect(md).toContain('- **Labor:** Synlab');
    expect(md).toContain('### Schilddruese');
    expect(md).toContain('| TSH | 2.8 | mU/l | 0.4-4.0 | normal |');
  });

  it('emits supplements as a single table grouped by category', () => {
    const profile = makeProfile();
    const supplements: Supplement[] = [
      {
        id: 's1',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        name: 'Magnesium 400',
        category: 'daily',
      },
      {
        id: 's2',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        name: 'Ibuprofen 400',
        category: 'on-demand',
      },
    ];
    const md = exportProfileAsMarkdown(profile, [], [], [], supplements, [], []);
    expect(md).toContain('## 5. Verträglichkeiten');
    expect(md).toContain('### Supplemente / Medikamente');
    expect(md).toContain('| täglich | Magnesium 400 |');
    expect(md).toContain('| bei Bedarf | Ibuprofen 400 |');
  });

  it('groups open points by context and includes priority prefix', () => {
    const profile = makeProfile();
    const points: OpenPoint[] = [
      {
        id: 'op1',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        text: 'MRT besprechen',
        context: 'Beim naechsten Arztbesuch',
        resolved: false,
        priority: 'hoch',
      },
      {
        id: 'op2',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        text: 'TSH nachmessen',
        context: 'Beim naechsten Arztbesuch',
        resolved: false,
      },
    ];
    const md = exportProfileAsMarkdown(profile, [], [], [], [], points, []);
    expect(md).toContain('## 11. Offene Punkte');
    expect(md).toContain('### Beim naechsten Arztbesuch');
    expect(md).toContain('- [hoch] MRT besprechen');
    expect(md).toContain('- TSH nachmessen');
  });

  it('sorts timeline entries newest-first by updatedAt', () => {
    const profile = makeProfile();
    const entries: TimelineEntry[] = [
      {
        id: 't1',
        profileId: 'p1',
        createdAt: 100,
        updatedAt: 100,
        period: 'Oktober 2025',
        title: 'Erster Eintrag',
        content: 'Alter Text',
        source: 'user',
      },
      {
        id: 't2',
        profileId: 'p1',
        createdAt: 200,
        updatedAt: 200,
        period: 'November 2025',
        title: 'Neuer Eintrag',
        content: 'Neuer Text',
        source: 'user',
      },
    ];
    const md = exportProfileAsMarkdown(profile, [], [], [], [], [], entries);
    expect(md).toContain('## 10. Verlaufsnotizen');
    const nIdx = md.indexOf('### November 2025 - Neuer Eintrag');
    const oIdx = md.indexOf('### Oktober 2025 - Erster Eintrag');
    expect(nIdx).toBeGreaterThan(-1);
    expect(oIdx).toBeGreaterThan(nIdx);
  });

  it('round-trips a realistic profile through parseProfile', () => {
    const profile = makeProfile({
      lastUpdateReason: 'Initial-Export test',
    });
    const observations: Observation[] = [
      makeObservation('Schulter rechts'),
      makeObservation('Kopfschmerzen', {
        fact: 'Pulsierend rechts',
        pattern: 'Vor Wetterumschwung',
        selfRegulation: 'Magnesium, Rueckzug',
        status: 'Episodisch',
      }),
    ];
    const labReport: LabReport = {
      id: 'r1',
      profileId: 'p1',
      createdAt: 0,
      updatedAt: 0,
      reportDate: '2025-10-15',
      labName: 'Synlab',
      categoryAssessments: {},
    };
    const labValues: LabValue[] = [
      {
        id: 'v1',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        reportId: 'r1',
        category: 'Schilddruese',
        parameter: 'TSH',
        result: '2.8',
        unit: 'mU/l',
        referenceRange: '0.4-4.0',
        assessment: 'normal',
      },
    ];
    const supplements: Supplement[] = [
      {
        id: 's1',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        name: 'Magnesium 400',
        category: 'daily',
      },
    ];
    const openPoints: OpenPoint[] = [
      {
        id: 'op1',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        text: 'Schilddruesen-Werte nachkontrollieren',
        context: 'Beim naechsten Arztbesuch',
        resolved: false,
      },
    ];
    const timeline: TimelineEntry[] = [
      {
        id: 't1',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        period: 'November 2025',
        title: 'Migrane-Frequenz niedriger',
        content: 'Verbesserung etwa 50 Prozent seit Magnesium-Supplementation.',
        source: 'user',
      },
    ];

    const md = exportProfileAsMarkdown(
      profile,
      observations,
      [labReport],
      labValues,
      supplements,
      openPoints,
      timeline,
    );
    const result = parseProfile(md);

    expect(result.observations.length).toBe(observations.length);
    const parsedThemes = result.observations.map((o) => o.theme).sort();
    const originalThemes = observations.map((o) => o.theme).sort();
    expect(parsedThemes).toEqual(originalThemes);
    const kopf = result.observations.find((o) => o.theme === 'Kopfschmerzen');
    expect(kopf?.fact).toBe('Pulsierend rechts');
    expect(kopf?.pattern).toBe('Vor Wetterumschwung');
    expect(kopf?.selfRegulation).toBe('Magnesium, Rueckzug');
    expect(kopf?.status).toBe('Episodisch');

    expect(result.supplements.length).toBe(supplements.length);
    expect(result.supplements[0]?.name).toBe('Magnesium 400');
    expect(result.supplements[0]?.category).toBe('daily');

    expect(result.openPoints.length).toBe(openPoints.length);
    expect(result.openPoints[0]?.context).toBe('Beim naechsten Arztbesuch');
    expect(result.openPoints[0]?.text).toContain('Schilddruesen-Werte nachkontrollieren');

    expect(result.labReports.length).toBeGreaterThanOrEqual(1);
    expect(result.timelineEntries.length).toBeGreaterThanOrEqual(1);
  });

  it('date range filter excludes lab reports and timeline entries outside the window', () => {
    const profile = makeProfile();
    const reports: LabReport[] = [
      {
        id: 'old',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        reportDate: '2020-01-01',
        labName: 'A',
        categoryAssessments: {},
      },
      {
        id: 'new',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        reportDate: '2026-01-01',
        labName: 'B',
        categoryAssessments: {},
      },
    ];
    const md = exportProfileAsMarkdown(profile, [], reports, [], [], [], [], {
      dateRange: { from: new Date('2025-01-01'), to: new Date('2026-12-31') },
    });
    expect(md).toContain('### Befund vom 01.01.2026');
    expect(md).not.toContain('### Befund vom 01.01.2020');
  });

  it('date range with only `from` keeps items at or after the lower bound', () => {
    const profile = makeProfile();
    const reports: LabReport[] = [
      {
        id: 'old',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        reportDate: '2020-01-01',
        labName: 'A',
        categoryAssessments: {},
      },
      {
        id: 'new',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        reportDate: '2026-01-01',
        labName: 'B',
        categoryAssessments: {},
      },
    ];
    const md = exportProfileAsMarkdown(profile, [], reports, [], [], [], [], {
      dateRange: { from: new Date('2025-01-01') },
    });
    expect(md).toContain('### Befund vom 01.01.2026');
    expect(md).not.toContain('### Befund vom 01.01.2020');
  });

  it('date range with only `to` keeps items at or before the upper bound', () => {
    const profile = makeProfile();
    const reports: LabReport[] = [
      {
        id: 'old',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        reportDate: '2020-01-01',
        labName: 'A',
        categoryAssessments: {},
      },
      {
        id: 'new',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        reportDate: '2026-01-01',
        labName: 'B',
        categoryAssessments: {},
      },
    ];
    const md = exportProfileAsMarkdown(profile, [], reports, [], [], [], [], {
      dateRange: { to: new Date('2025-01-01') },
    });
    expect(md).toContain('### Befund vom 01.01.2020');
    expect(md).not.toContain('### Befund vom 01.01.2026');
  });

  it('empty date-range object (both bounds missing) is a no-op', () => {
    const profile = makeProfile();
    const reports: LabReport[] = [
      {
        id: 'r1',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        reportDate: '2020-01-01',
        labName: 'A',
        categoryAssessments: {},
      },
    ];
    const md = exportProfileAsMarkdown(profile, [], reports, [], [], [], [], {
      dateRange: {},
    });
    expect(md).toContain('### Befund vom 01.01.2020');
  });

  it('theme filter excludes observations whose theme is not in the whitelist', () => {
    const profile = makeProfile();
    const obs = [makeObservation('Schulter rechts'), makeObservation('Kopfschmerzen')];
    const md = exportProfileAsMarkdown(profile, obs, [], [], [], [], [], {
      themes: ['Kopfschmerzen'],
    });
    expect(md).toContain('### Kopfschmerzen');
    expect(md).not.toContain('### Schulter rechts');
  });

  it('escapes pipe characters inside table cells so the table stays valid', () => {
    const profile = makeProfile();
    const supplements: Supplement[] = [
      {
        id: 's1',
        profileId: 'p1',
        createdAt: 0,
        updatedAt: 0,
        name: 'Weird | Name',
        category: 'daily',
      },
    ];
    const md = exportProfileAsMarkdown(profile, [], [], [], supplements, [], []);
    expect(md).toContain('Weird \\| Name');
  });

  it('footer carries export date, Phylax version, and profile version', () => {
    const profile = makeProfile({ version: '1.3.5' });
    const md = exportProfileAsMarkdown(profile, [], [], [], [], [], []);
    expect(md).toMatch(/\*\*Export erstellt:\*\* \d{4}-\d{2}-\d{2}/);
    expect(md).toContain('**Phylax-Version:** 1.0.0');
    expect(md).toContain('**Profil-Version:** 1.3.5');
  });

  it('includes warning signs and external references when present', () => {
    const profile = makeProfile({
      externalReferences: ['https://example.com/befund'],
    });
    const md = exportProfileAsMarkdown(profile, [], [], [], [], [], []);
    expect(md).toContain('## 7. Warnsignale');
    expect(md).toContain('- Akute Brustschmerzen');
    expect(md).toContain('## 9. Externe Referenzen');
    expect(md).toContain('- https://example.com/befund');
  });
});
