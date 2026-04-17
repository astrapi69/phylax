import { describe, it, expect } from 'vitest';
import type { Profile, Observation } from '../../../domain';
import { extractProfileSummary, formatProfileSummary } from './profileContext';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  const now = Date.UTC(2026, 2, 15); // 2026-03-15
  const base: Profile = {
    id: 'p1',
    profileId: 'p1',
    createdAt: now,
    updatedAt: now,
    baseData: {
      name: 'Max Mustermann',
      age: 43,
      weightHistory: [],
      knownDiagnoses: ['Impingement links', 'Veneninsuffizienz'],
      currentMedications: [],
      relevantLimitations: [],
      profileType: 'self',
    },
    warningSigns: [],
    externalReferences: [],
    version: '1.0',
  };
  return { ...base, ...overrides, baseData: { ...base.baseData, ...overrides.baseData } };
}

function makeObservation(theme: string, overrides: Partial<Observation> = {}): Observation {
  return {
    id: `obs-${theme}`,
    profileId: 'p1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    theme,
    fact: '',
    pattern: '',
    selfRegulation: '',
    status: '',
    source: 'user',
    extraSections: {},
    ...overrides,
  };
}

describe('extractProfileSummary', () => {
  it('extracts name via getDisplayName and age from baseData', () => {
    const summary = extractProfileSummary(makeProfile(), []);
    expect(summary.name).toBe('Max Mustermann');
    expect(summary.age).toBe(43);
  });

  it('uses the display-name fallback when name is absent', () => {
    const profile = makeProfile({ baseData: { ...makeProfile().baseData, name: undefined } });
    const summary = extractProfileSummary(profile, []);
    expect(summary.name).toBe('Mein Profil');
  });

  it('extracts known diagnoses verbatim', () => {
    const summary = extractProfileSummary(makeProfile(), []);
    expect(summary.knownDiagnoses).toEqual(['Impingement links', 'Veneninsuffizienz']);
  });

  it('extracts unique themes from observations, German-locale sorted', () => {
    const obs = [
      makeObservation('Schulter'),
      makeObservation('Ernaehrung'),
      makeObservation('Schulter'), // duplicate
      makeObservation('Oedem'),
    ];
    const summary = extractProfileSummary(makeProfile(), obs);
    // de collator: E, O(e), S
    expect(summary.existingThemes).toEqual(['Ernaehrung', 'Oedem', 'Schulter']);
  });

  it('formats updatedAt as YYYY-MM-DD', () => {
    const summary = extractProfileSummary(makeProfile(), []);
    expect(summary.lastUpdate).toBe('2026-03-15');
  });

  it('marks proxy profiles and carries managedBy', () => {
    const profile = makeProfile({
      baseData: {
        ...makeProfile().baseData,
        profileType: 'proxy',
        managedBy: 'Anna Mueller',
        name: 'Mutter',
      },
    });
    const summary = extractProfileSummary(profile, []);
    expect(summary.isProxy).toBe(true);
    expect(summary.managedBy).toBe('Anna Mueller');
    expect(summary.name).toBe('Mutter');
  });

  it('omits age when it is not a number', () => {
    const profile = makeProfile({ baseData: { ...makeProfile().baseData, age: undefined } });
    const summary = extractProfileSummary(profile, []);
    expect(summary.age).toBeUndefined();
  });

  it('omits managedBy when it is blank or whitespace', () => {
    const profile = makeProfile({
      baseData: {
        ...makeProfile().baseData,
        profileType: 'proxy',
        managedBy: '   ',
      },
    });
    const summary = extractProfileSummary(profile, []);
    expect(summary.managedBy).toBeUndefined();
    expect(summary.isProxy).toBe(true);
  });
});

describe('formatProfileSummary', () => {
  it('renders a readable bulleted block with all fields', () => {
    const summary = extractProfileSummary(makeProfile(), [
      makeObservation('Schulter'),
      makeObservation('Schlaf'),
    ]);
    const text = formatProfileSummary(summary);

    expect(text).toContain('Aktuelles Profil:');
    expect(text).toContain('- Name: Max Mustermann');
    expect(text).toContain('- Alter: 43 Jahre');
    expect(text).toContain('- Bekannte Diagnosen: Impingement links, Veneninsuffizienz');
    expect(text).toContain('- Bestehende Beobachtungsthemen: Schlaf, Schulter');
    expect(text).toContain('- Letzte Aktualisierung: 2026-03-15');
  });

  it('falls back to a single-line marker for a truly empty profile', () => {
    const profile = makeProfile({
      baseData: {
        ...makeProfile().baseData,
        age: undefined,
        knownDiagnoses: [],
      },
    });
    const text = formatProfileSummary(extractProfileSummary(profile, []));
    expect(text).toBe('Aktuelles Profil: (noch keine Angaben)');
  });

  it('includes Betreuer/in line only for proxy profiles with managedBy set', () => {
    const profile = makeProfile({
      baseData: {
        ...makeProfile().baseData,
        profileType: 'proxy',
        managedBy: 'Anna Mueller',
        name: 'Mutter',
      },
    });
    const text = formatProfileSummary(extractProfileSummary(profile, []));
    expect(text).toContain('- Betreuer/in: Anna Mueller');
    expect(text).toContain('- Name: Mutter');
  });

  it('omits Betreuer/in for self profiles even when logic is tickled', () => {
    const text = formatProfileSummary(extractProfileSummary(makeProfile(), []));
    expect(text).not.toContain('Betreuer/in');
  });
});
