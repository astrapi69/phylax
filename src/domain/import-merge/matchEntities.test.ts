import { describe, it, expect } from 'vitest';
import type {
  Observation,
  LabReport,
  LabValue,
  Supplement,
  OpenPoint,
  ProfileVersion,
  TimelineEntry,
} from '..';
import {
  matchObservations,
  matchLabReports,
  matchLabValuesPerReport,
  matchLabValuesWithinReport,
  matchSupplements,
  matchOpenPoints,
  matchProfileVersions,
  matchTimelineEntries,
  countOutcomes,
} from './matchEntities';

const PROFILE_ID = 'p1';

function makeObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: 'obs-existing-1',
    profileId: PROFILE_ID,
    createdAt: 1,
    updatedAt: 2,
    theme: 'Linkes Knie',
    fact: 'Schmerz bei Belastung.',
    pattern: '',
    selfRegulation: '',
    status: 'Stabil',
    source: 'user',
    extraSections: {},
    ...overrides,
  };
}

function makeLabReport(overrides: Partial<LabReport> = {}): LabReport {
  return {
    id: 'rep-existing-1',
    profileId: PROFILE_ID,
    createdAt: 1,
    updatedAt: 2,
    reportDate: '2026-04-15',
    labName: 'Synlab',
    categoryAssessments: {},
    ...overrides,
  };
}

function makeLabValue(overrides: Partial<LabValue> = {}): LabValue {
  return {
    id: 'val-existing-1',
    profileId: PROFILE_ID,
    createdAt: 1,
    updatedAt: 2,
    reportId: 'rep-existing-1',
    category: 'Blutbild',
    parameter: 'Hämoglobin',
    result: '14.2',
    unit: 'g/dl',
    ...overrides,
  };
}

function makeSupplement(overrides: Partial<Supplement> = {}): Supplement {
  return {
    id: 'sup-existing-1',
    profileId: PROFILE_ID,
    createdAt: 1,
    updatedAt: 2,
    name: 'Vitamin D3',
    brand: 'Pure',
    category: 'daily',
    ...overrides,
  };
}

function makeOpenPoint(overrides: Partial<OpenPoint> = {}): OpenPoint {
  return {
    id: 'op-existing-1',
    profileId: PROFILE_ID,
    createdAt: 1,
    updatedAt: 2,
    text: 'Wasser trinken',
    context: 'Wiederholungs-Blutabnahme',
    resolved: false,
    ...overrides,
  };
}

function makeProfileVersion(overrides: Partial<ProfileVersion> = {}): ProfileVersion {
  return {
    id: 'pv-existing-1',
    profileId: PROFILE_ID,
    createdAt: 1,
    updatedAt: 2,
    version: '1.0',
    changeDescription: 'Erstprofil',
    changeDate: '2025-12-01',
    ...overrides,
  };
}

function makeTimelineEntry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    id: 'tl-existing-1',
    profileId: PROFILE_ID,
    createdAt: 1,
    updatedAt: 2,
    period: 'März 2026',
    title: 'Brustkorbbeschwerden',
    content: '...',
    source: 'user',
    ...overrides,
  };
}

describe('matchObservations', () => {
  it('parsed entity with no key match buckets as new', () => {
    const matches = matchObservations([], [makeObservation({ theme: 'Hüfte' })]);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.outcome).toBe('new');
  });

  it('parsed entity matching every field of an existing one buckets as identical', () => {
    const existing = makeObservation();
    // Parsed has the same content but no DB-managed bookkeeping fields.
    const parsed = makeObservation({ id: 'parsed-1', createdAt: 999, updatedAt: 1000 });
    const matches = matchObservations([existing], [parsed]);
    expect(matches[0]?.outcome).toBe('identical');
  });

  it('parsed entity matching the key but differing on fact buckets as conflict with one diff', () => {
    const existing = makeObservation({ fact: 'Schmerz bei Belastung.' });
    const parsed = makeObservation({ fact: 'Schmerz nur abends.' });
    const matches = matchObservations([existing], [parsed]);
    expect(matches[0]?.outcome).toBe('conflict');
    if (matches[0]?.outcome === 'conflict') {
      expect(matches[0].diffs).toHaveLength(1);
      expect(matches[0].diffs[0]?.field).toBe('fact');
      expect(matches[0].diffs[0]?.mineValue).toBe('Schmerz bei Belastung.');
      expect(matches[0].diffs[0]?.theirsValue).toBe('Schmerz nur abends.');
    }
  });

  it('skips DomainEntity bookkeeping fields when computing diffs', () => {
    // Different id / createdAt / updatedAt must NOT count as diffs.
    const existing = makeObservation();
    const parsed = makeObservation({
      id: 'completely-different',
      createdAt: 99999,
      updatedAt: 99999,
      profileId: 'p2',
    });
    const matches = matchObservations([existing], [parsed]);
    expect(matches[0]?.outcome).toBe('identical');
  });

  it('two-way diff: extraSections keys differ produces a structural conflict', () => {
    const existing = makeObservation({ extraSections: { Notiz: 'A' } });
    const parsed = makeObservation({ extraSections: { Notiz: 'B' } });
    const matches = matchObservations([existing], [parsed]);
    expect(matches[0]?.outcome).toBe('conflict');
  });

  it('handles a 3+3 matrix with one of each outcome', () => {
    const existing = [
      makeObservation({ theme: 'Linkes Knie', fact: 'fact-A' }),
      makeObservation({ theme: 'Schulter', fact: 'untouched', id: 'obs-existing-2' }),
    ];
    const parsed = [
      // identical
      makeObservation({ theme: 'Linkes Knie', fact: 'fact-A', id: 'parsed-1' }),
      // conflict
      makeObservation({ theme: 'Schulter', fact: 'fact-changed', id: 'parsed-2' }),
      // new
      makeObservation({ theme: 'Hüfte', fact: 'fact-new', id: 'parsed-3' }),
    ];
    const matches = matchObservations(existing, parsed);
    expect(matches.map((m) => m.outcome)).toEqual(['identical', 'conflict', 'new']);
  });
});

describe('matchLabReports', () => {
  it('matches by reportDate', () => {
    const existing = [makeLabReport({ reportDate: '2026-04-15' })];
    const parsed = [makeLabReport({ reportDate: '2026-04-15', labName: 'Different lab' })];
    const matches = matchLabReports(existing, parsed);
    expect(matches[0]?.outcome).toBe('conflict');
  });

  it('non-matching reportDate buckets as new', () => {
    const existing = [makeLabReport({ reportDate: '2026-04-15' })];
    const parsed = [makeLabReport({ reportDate: '2025-12-01' })];
    const matches = matchLabReports(existing, parsed);
    expect(matches[0]?.outcome).toBe('new');
  });
});

describe('matchSupplements', () => {
  it('Vitamin D3 no-brand vs Vitamin D3 (Pure) are NOT matched (W1)', () => {
    const existing = [makeSupplement({ name: 'Vitamin D3', brand: undefined })];
    const parsed = [makeSupplement({ name: 'Vitamin D3', brand: 'Pure' })];
    const matches = matchSupplements(existing, parsed);
    expect(matches[0]?.outcome).toBe('new');
  });

  it('same name + same brand match identical when fields equal', () => {
    const existing = [makeSupplement({ name: 'Vitamin D3', brand: 'Pure' })];
    const parsed = [makeSupplement({ name: 'Vitamin D3', brand: 'Pure', id: 'parsed-1' })];
    const matches = matchSupplements(existing, parsed);
    expect(matches[0]?.outcome).toBe('identical');
  });

  it('same key but different recommendation surfaces conflict on recommendation', () => {
    const existing = [makeSupplement({ recommendation: '2000 IE/Tag' })];
    const parsed = [makeSupplement({ recommendation: '4000 IE/Tag', id: 'parsed-1' })];
    const matches = matchSupplements(existing, parsed);
    expect(matches[0]?.outcome).toBe('conflict');
    if (matches[0]?.outcome === 'conflict') {
      expect(matches[0].diffs.map((d) => d.field)).toEqual(['recommendation']);
    }
  });
});

describe('matchOpenPoints', () => {
  it('matches by context and surfaces text-differing entries as conflicts', () => {
    const existing = [makeOpenPoint({ text: 'Wasser trinken' })];
    const parsed = [makeOpenPoint({ text: 'Wasser plus Tee', id: 'parsed-1' })];
    const matches = matchOpenPoints(existing, parsed);
    expect(matches[0]?.outcome).toBe('conflict');
  });
});

describe('matchProfileVersions', () => {
  it('matches by version label', () => {
    const existing = [makeProfileVersion({ version: '1.0', changeDescription: 'A' })];
    const parsed = [makeProfileVersion({ version: '1.0', changeDescription: 'B', id: 'parsed-1' })];
    const matches = matchProfileVersions(existing, parsed);
    expect(matches[0]?.outcome).toBe('conflict');
  });

  it('different version labels are new', () => {
    const existing = [makeProfileVersion({ version: '1.0' })];
    const parsed = [makeProfileVersion({ version: '2.0', id: 'parsed-1' })];
    const matches = matchProfileVersions(existing, parsed);
    expect(matches[0]?.outcome).toBe('new');
  });
});

describe('matchTimelineEntries', () => {
  it('different titles in same period are different keys', () => {
    const existing = [makeTimelineEntry({ period: 'März 2026', title: 'Schulter' })];
    const parsed = [makeTimelineEntry({ period: 'März 2026', title: 'Knie', id: 'parsed-1' })];
    const matches = matchTimelineEntries(existing, parsed);
    expect(matches[0]?.outcome).toBe('new');
  });
});

describe('matchLabValuesWithinReport', () => {
  it('within a single matched report, parameter is the natural key', () => {
    const existing = [
      makeLabValue({ parameter: 'Hämoglobin', result: '14.2' }),
      makeLabValue({ id: 'val-existing-2', parameter: 'Leukozyten', result: '6.04' }),
    ];
    const parsed = [
      makeLabValue({ parameter: 'Hämoglobin', result: '13.5', id: 'parsed-1' }),
      makeLabValue({ parameter: 'Kreatinin', result: '0.9', id: 'parsed-2' }),
    ];
    const matches = matchLabValuesWithinReport(existing, parsed);
    expect(matches[0]?.outcome).toBe('conflict');
    expect(matches[1]?.outcome).toBe('new');
  });
});

describe('matchLabValuesPerReport', () => {
  it('values whose parent report is new bucket as new even if parameter exists elsewhere', () => {
    // Parent report 'new' -> children all new.
    const parsedReport = makeLabReport({ reportDate: '2026-05-01', id: 'parsed-r-1' });
    const parentMatches = matchLabReports([], [parsedReport]);
    const parsedValues = [
      Object.assign(makeLabValue({ parameter: 'Hämoglobin', id: 'parsed-v-1' }), {
        reportIndex: 0,
      }),
    ];
    const matches = matchLabValuesPerReport(parentMatches, parsedValues, new Map());
    expect(matches[0]?.outcome).toBe('new');
  });

  it('values whose parent report matches use the existing report id for value lookup', () => {
    const existingReport = makeLabReport({ reportDate: '2026-04-15', id: 'rep-existing-A' });
    const existingValues = [makeLabValue({ reportId: 'rep-existing-A', parameter: 'Hämoglobin' })];
    const parsedReport = makeLabReport({ reportDate: '2026-04-15', id: 'parsed-r-1' });
    const parentMatches = matchLabReports([existingReport], [parsedReport]);
    const parsedValues = [
      Object.assign(makeLabValue({ parameter: 'Hämoglobin', result: '14.2', id: 'parsed-v-1' }), {
        reportIndex: 0,
      }),
    ];
    const matches = matchLabValuesPerReport(
      parentMatches,
      parsedValues,
      new Map([['rep-existing-A', existingValues]]),
    );
    expect(matches[0]?.outcome).toBe('identical');
  });
});

describe('countOutcomes', () => {
  it('tallies new / identical / conflict per slice', () => {
    const counts = countOutcomes([
      { outcome: 'new', kind: 'observations', parsed: makeObservation({ theme: 'X' }) },
      {
        outcome: 'identical',
        kind: 'observations',
        parsed: makeObservation(),
        existing: makeObservation(),
      },
      {
        outcome: 'conflict',
        kind: 'observations',
        parsed: makeObservation({ theme: 'Y', fact: 'A' }),
        existing: makeObservation({ theme: 'Y', fact: 'B' }),
        diffs: [{ field: 'fact', mineValue: 'B', theirsValue: 'A' }],
      },
      {
        outcome: 'conflict',
        kind: 'observations',
        parsed: makeObservation({ theme: 'Z', fact: 'C' }),
        existing: makeObservation({ theme: 'Z', fact: 'D' }),
        diffs: [{ field: 'fact', mineValue: 'D', theirsValue: 'C' }],
      },
    ]);
    expect(counts).toEqual({ new: 1, identical: 1, conflict: 2 });
  });
});
