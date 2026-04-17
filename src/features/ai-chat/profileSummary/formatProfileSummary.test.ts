import { describe, it, expect } from 'vitest';
import type {
  Profile,
  Observation,
  LabReport,
  LabValue,
  Supplement,
  OpenPoint,
} from '../../../domain';
import {
  formatProfileShareSummary,
  summarizeField,
  truncateAtWordBoundary,
  formatWeightTrend,
  type ProfileShareInputs,
} from './formatProfileSummary';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  const now = Date.UTC(2026, 2, 15);
  const base: Profile = {
    id: 'p1',
    profileId: 'p1',
    createdAt: now,
    updatedAt: now,
    baseData: {
      name: 'Max Mustermann',
      age: 56,
      heightCm: 183,
      weightKg: 92,
      targetWeightKg: 82,
      weightHistory: [
        { date: '2026-01-15', weightKg: 84 },
        { date: '2026-03-10', weightKg: 92 },
      ],
      knownDiagnoses: ['Impingement links', 'Veneninsuffizienz'],
      currentMedications: ['Ibuprofen bei Bedarf'],
      relevantLimitations: ['Gelenkprobleme beidseitig'],
      profileType: 'self',
      primaryDoctor: { name: 'Dr. Mueller', specialty: 'Allgemeinmedizin' },
    },
    warningSigns: ['Brustschmerzen bei Belastung', 'Ploetzliche Atemnot'],
    externalReferences: [],
    version: '1.3.1',
  };
  return {
    ...base,
    ...overrides,
    baseData: { ...base.baseData, ...overrides.baseData },
  };
}

function makeObservation(theme: string, overrides: Partial<Observation> = {}): Observation {
  return {
    id: `obs-${theme}`,
    profileId: 'p1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    theme,
    fact: 'Default fact.',
    pattern: 'Default pattern.',
    selfRegulation: 'Default self-regulation.',
    status: 'Stabil',
    source: 'user',
    extraSections: {},
    ...overrides,
  };
}

function makeLabReport(overrides: Partial<LabReport> = {}): LabReport {
  return {
    id: 'r1',
    profileId: 'p1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    reportDate: '2026-02-27',
    labName: 'Beispiel-Labor Musterstadt',
    categoryAssessments: {},
    ...overrides,
  };
}

function makeLabValue(overrides: Partial<LabValue>): LabValue {
  return {
    id: `v-${overrides.parameter ?? 'x'}`,
    profileId: 'p1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    reportId: 'r1',
    category: 'Blutbild',
    parameter: 'Kreatinin',
    result: '1,2',
    ...overrides,
  };
}

function makeSupplement(name: string, category: Supplement['category']): Supplement {
  return {
    id: `s-${name}`,
    profileId: 'p1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    name,
    category,
  };
}

function makeOpenPoint(text: string, overrides: Partial<OpenPoint> = {}): OpenPoint {
  return {
    id: `op-${text}`,
    profileId: 'p1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    text,
    context: 'Beim naechsten Arztbesuch',
    resolved: false,
    ...overrides,
  };
}

function baseInputs(overrides: Partial<ProfileShareInputs> = {}): ProfileShareInputs {
  return {
    profile: makeProfile(),
    observations: [],
    latestReport: null,
    latestReportValues: [],
    supplements: [],
    unresolvedOpenPoints: [],
    ...overrides,
  };
}

describe('truncateAtWordBoundary', () => {
  it('returns text unchanged when shorter than limit', () => {
    expect(truncateAtWordBoundary('kurz', 100)).toBe('kurz');
  });

  it('cuts at the last word boundary before the limit and adds ellipsis', () => {
    const text = 'ein zwei drei vier fuenf sechs sieben';
    // Limit = 20 → "ein zwei drei vier " then trim and ellipsis.
    const result = truncateAtWordBoundary(text, 20);
    expect(result).toBe('ein zwei drei vier...');
    expect(result).not.toMatch(/\w…$/);
  });

  it('falls back to hard cut for a single very long word', () => {
    const result = truncateAtWordBoundary('x'.repeat(300), 50);
    expect(result).toHaveLength(53);
    expect(result.endsWith('...')).toBe(true);
  });
});

describe('summarizeField', () => {
  it('collapses internal whitespace and newlines', () => {
    expect(summarizeField('a  b\n\nc\td')).toBe('a b c d');
  });

  it('truncates long multi-line content at a word boundary', () => {
    const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join('\n');
    const result = summarizeField(long);
    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(203);
  });
});

describe('formatWeightTrend', () => {
  it('renders first -> last when history has 2+ entries', () => {
    expect(
      formatWeightTrend([
        { date: '2026-01-15', weightKg: 84 },
        { date: '2026-03-10', weightKg: 92 },
      ]),
    ).toBe('84 kg (Jan 2026) -> 92 kg (Maerz 2026)');
  });

  it('returns null when history has fewer than 2 entries', () => {
    expect(formatWeightTrend([])).toBeNull();
    expect(formatWeightTrend([{ date: '2026-01-15', weightKg: 84 }])).toBeNull();
  });

  it('falls back to the ISO date when the format is unexpected', () => {
    expect(
      formatWeightTrend([
        { date: 'not-a-date', weightKg: 84 },
        { date: '2026-03-10', weightKg: 92 },
      ]),
    ).toBe('84 kg (not-a-date) -> 92 kg (Maerz 2026)');
  });
});

describe('formatProfileShareSummary', () => {
  it('renders the heading with the profile name', () => {
    const { markdown } = formatProfileShareSummary(baseInputs());
    expect(markdown).toMatch(/^# Profil: Max Mustermann/);
  });

  it('includes Basisdaten with weight, trend, diagnoses, medications, limitations, doctor', () => {
    const { markdown } = formatProfileShareSummary(baseInputs());
    expect(markdown).toContain('## Basisdaten');
    expect(markdown).toContain('- Alter: 56 Jahre');
    expect(markdown).toContain('- Groesse: 183 cm');
    expect(markdown).toContain('- Gewicht: 92 kg (Ziel: 82 kg)');
    expect(markdown).toContain('- Gewichtsverlauf: 84 kg (Jan 2026) -> 92 kg (Maerz 2026)');
    expect(markdown).toContain('- Bekannte Diagnosen: Impingement links, Veneninsuffizienz');
    expect(markdown).toContain('- Aktuelle Medikamente: Ibuprofen bei Bedarf');
    expect(markdown).toContain('- Einschraenkungen: Gelenkprobleme beidseitig');
    expect(markdown).toContain('- Hausarzt/Aerztin: Dr. Mueller (Allgemeinmedizin)');
  });

  it('groups observations by theme, sorted German-locale, and truncates each field', () => {
    const longFact = Array.from({ length: 40 }, (_, i) => `fakt${i}`).join(' ');
    const inputs = baseInputs({
      observations: [
        makeObservation('Schulter', { fact: longFact }),
        makeObservation('Ernaehrung'),
        makeObservation('Oedem'),
      ],
    });
    const { markdown } = formatProfileShareSummary(inputs);
    const posE = markdown.indexOf('### Ernaehrung');
    const posO = markdown.indexOf('### Oedem');
    const posS = markdown.indexOf('### Schulter');
    expect(posE).toBeGreaterThan(-1);
    expect(posE).toBeLessThan(posO);
    expect(posO).toBeLessThan(posS);

    // Truncated fact ends with ellipsis and stays under the 200-char budget.
    const schulterSection = markdown.slice(posS);
    const factLine = schulterSection.split('\n').find((l) => l.startsWith('- Beobachtung:'));
    if (!factLine) throw new Error('expected a "- Beobachtung:" line in the Schulter section');
    expect(factLine.endsWith('...')).toBe(true);
    expect(factLine.length).toBeLessThan(250);
  });

  it('only includes abnormal lab values and omits the section when none exist', () => {
    const normalOnly: LabValue[] = [
      makeLabValue({ parameter: 'TSH', result: '2,1', unit: 'mU/l', assessment: 'normal' }),
      makeLabValue({
        parameter: 'Na',
        result: '140',
        unit: 'mmol/l',
        assessment: 'im Normbereich',
      }),
    ];
    const allNormal = formatProfileShareSummary(
      baseInputs({ latestReport: makeLabReport(), latestReportValues: normalOnly }),
    );
    expect(allNormal.markdown).not.toContain('## Laborwerte');
    expect(allNormal.counts.abnormalLabCount).toBe(0);

    const mixed: LabValue[] = [
      makeLabValue({ parameter: 'TSH', result: '2,1', assessment: 'normal' }),
      makeLabValue({
        parameter: 'Kreatinin',
        result: '1,5',
        unit: 'mg/dl',
        referenceRange: '0,7-1,2',
        assessment: 'erhoeht',
      }),
    ];
    const withAbnormal = formatProfileShareSummary(
      baseInputs({ latestReport: makeLabReport(), latestReportValues: mixed }),
    );
    expect(withAbnormal.markdown).toContain('## Laborwerte');
    expect(withAbnormal.markdown).toContain('- Kreatinin: 1,5 mg/dl (Referenz: 0,7-1,2) - erhoeht');
    expect(withAbnormal.markdown).not.toContain('TSH');
    expect(withAbnormal.counts.abnormalLabCount).toBe(1);
  });

  it('renders supplement categories in German and includes all categories', () => {
    const { markdown } = formatProfileShareSummary(
      baseInputs({
        supplements: [
          makeSupplement('Vitamin D3 2000 IE', 'daily'),
          makeSupplement('Omega-3', 'regular'),
          makeSupplement('Magnesium', 'on-demand'),
          makeSupplement('Kreatin', 'paused'),
        ],
      }),
    );
    expect(markdown).toContain('- Vitamin D3 2000 IE (taeglich)');
    expect(markdown).toContain('- Omega-3 (regelmaessig)');
    expect(markdown).toContain('- Magnesium (bei Bedarf)');
    expect(markdown).toContain('- Kreatin (pausiert)');
  });

  it('includes only unresolved open points and omits the section when empty', () => {
    const points: OpenPoint[] = [
      makeOpenPoint('Wiederholungs-Blutabnahme', { priority: 'Hoch' }),
      makeOpenPoint('Knie-MRT besprechen'),
    ];
    const withPoints = formatProfileShareSummary(baseInputs({ unresolvedOpenPoints: points }));
    expect(withPoints.markdown).toContain('## Offene Punkte (ungeloest)');
    expect(withPoints.markdown).toContain('- [Hoch] Wiederholungs-Blutabnahme');
    expect(withPoints.markdown).toContain('- Knie-MRT besprechen');

    const empty = formatProfileShareSummary(baseInputs({ unresolvedOpenPoints: [] }));
    expect(empty.markdown).not.toContain('Offene Punkte');
  });

  it('includes warning signs when present', () => {
    const { markdown } = formatProfileShareSummary(baseInputs());
    expect(markdown).toContain('## Warnsignale');
    expect(markdown).toContain('- Brustschmerzen bei Belastung');
    expect(markdown).toContain('- Ploetzliche Atemnot');
  });

  it('produces a minimal output for a bare-bones profile', () => {
    // Bypass makeProfile to avoid inheriting the default BaseData fields.
    const now = Date.UTC(2026, 2, 15);
    const bare: Profile = {
      id: 'p1',
      profileId: 'p1',
      createdAt: now,
      updatedAt: now,
      baseData: {
        weightHistory: [],
        knownDiagnoses: [],
        currentMedications: [],
        relevantLimitations: [],
        profileType: 'self',
      },
      warningSigns: [],
      externalReferences: [],
      version: '1.0',
    };
    const { markdown, counts } = formatProfileShareSummary({
      profile: bare,
      observations: [],
      latestReport: null,
      latestReportValues: [],
      supplements: [],
      unresolvedOpenPoints: [],
    });
    expect(markdown).toContain('# Profil: Mein Profil');
    expect(markdown).not.toContain('## Basisdaten');
    expect(markdown).not.toContain('## Beobachtungen');
    expect(markdown).not.toContain('## Laborwerte');
    expect(markdown).not.toContain('## Supplemente');
    expect(markdown).not.toContain('## Offene Punkte');
    expect(markdown).not.toContain('## Warnsignale');
    expect(counts).toEqual({
      observationCount: 0,
      abnormalLabCount: 0,
      supplementCount: 0,
      openPointCount: 0,
      warningSignCount: 0,
    });
  });

  it('for proxy profiles, includes a "Gefuehrt von" line', () => {
    const proxy = makeProfile({
      baseData: {
        ...makeProfile().baseData,
        profileType: 'proxy',
        managedBy: 'Anna Mueller',
        name: 'Mutter',
      },
    });
    const { markdown } = formatProfileShareSummary(baseInputs({ profile: proxy }));
    expect(markdown).toContain('# Profil: Mutter');
    expect(markdown).toContain('Gefuehrt von: Anna Mueller');
  });
});
