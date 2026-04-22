import { describe, it, expect } from 'vitest';
import type { Observation, Supplement } from '../../../domain';
import type {
  ParseResult,
  ParsedObservation,
  ParsedSupplement,
  ParsedOpenPoint,
} from '../../profile-import/parser/types';
import { computeDiff, diffItemCount } from './computeDiff';

function makeExistingObs(theme: string, overrides: Partial<Observation> = {}): Observation {
  return {
    id: `obs-${theme}`,
    profileId: 'p1',
    createdAt: 1,
    updatedAt: 100,
    theme,
    fact: 'existing fact',
    pattern: 'existing pattern',
    selfRegulation: 'existing self-reg',
    status: 'existing status',
    source: 'user',
    extraSections: {},
    ...overrides,
  };
}

function makeIncomingObs(
  theme: string,
  fields: Partial<ParsedObservation> = {},
): ParsedObservation {
  return {
    theme,
    fact: '',
    pattern: '',
    selfRegulation: '',
    status: '',
    source: 'user',
    extraSections: {},
    ...fields,
  };
}

function makeExistingSupplement(name: string, overrides: Partial<Supplement> = {}): Supplement {
  return {
    id: `s-${name}`,
    profileId: 'p1',
    createdAt: 1,
    updatedAt: 100,
    name,
    category: 'daily',
    ...overrides,
  };
}

function makeIncomingSupplement(
  name: string,
  fields: Partial<ParsedSupplement> = {},
): ParsedSupplement {
  return { name, category: 'daily', ...fields };
}

function makeIncomingOpenPoint(
  text: string,
  fields: Partial<ParsedOpenPoint> = {},
): ParsedOpenPoint {
  return { text, context: 'Beim nächsten Arztbesuch', resolved: false, ...fields };
}

function makeParseResult(overrides: Partial<ParseResult> = {}): ParseResult {
  return {
    profile: null,
    observations: [],
    labReports: [],
    labValues: [],
    supplements: [],
    openPoints: [],
    profileVersions: [],
    timelineEntries: [],
    report: { recognized: [], warnings: [], unrecognized: [], metadata: {} },
    originalMarkdown: '',
    ...overrides,
  };
}

describe('computeDiff', () => {
  it('puts unmatched incoming observations in the new bucket', () => {
    const parse = makeParseResult({ observations: [makeIncomingObs('Knie rechts')] });
    const diff = computeDiff(parse, { observations: [], supplements: [] });
    expect(diff.observations.new).toHaveLength(1);
    expect(diff.observations.changed).toHaveLength(0);
    expect(diff.observations.unchanged).toHaveLength(0);
  });

  it('matches observations by exact theme name', () => {
    const existing = makeExistingObs('Linke Schulter', { status: 'Chronisch' });
    const incoming = makeIncomingObs('Linke Schulter', { status: 'Stabil' });
    const diff = computeDiff(makeParseResult({ observations: [incoming] }), {
      observations: [existing],
      supplements: [],
    });
    expect(diff.observations.new).toHaveLength(0);
    expect(diff.observations.changed).toHaveLength(1);
    expect(diff.observations.changed[0]?.merged.status).toBe('Stabil');
    expect(diff.observations.changed[0]?.fieldsChanged).toEqual(['status']);
  });

  it('matches observations case-insensitive and trimmed', () => {
    const existing = makeExistingObs('Linke Schulter');
    const incoming = makeIncomingObs('  linke SCHULTER  ', { status: 'Neu' });
    const diff = computeDiff(makeParseResult({ observations: [incoming] }), {
      observations: [existing],
      supplements: [],
    });
    expect(diff.observations.changed).toHaveLength(1);
  });

  it('field-level merge: empty incoming field keeps existing value', () => {
    const existing = makeExistingObs('Schulter', {
      status: 'Akut',
      fact: 'Druckschmerz',
      pattern: 'Morgens',
      selfRegulation: 'Waerme',
    });
    const incoming = makeIncomingObs('Schulter', {
      status: '',
      fact: '',
      pattern: 'Nach Belastung',
      selfRegulation: '',
    });
    const diff = computeDiff(makeParseResult({ observations: [incoming] }), {
      observations: [existing],
      supplements: [],
    });
    const change = diff.observations.changed[0];
    expect(change?.merged.status).toBe('Akut');
    expect(change?.merged.fact).toBe('Druckschmerz');
    expect(change?.merged.pattern).toBe('Nach Belastung');
    expect(change?.merged.selfRegulation).toBe('Waerme');
    expect(change?.fieldsChanged).toEqual(['pattern']);
  });

  it('puts matched observation with no actual field changes in unchanged', () => {
    const existing = makeExistingObs('Schulter', {
      status: 'Akut',
      fact: 'Druck',
      pattern: 'Morgens',
      selfRegulation: 'Waerme',
    });
    // Incoming repeats every field verbatim - no real change.
    const incoming = makeIncomingObs('Schulter', {
      status: 'Akut',
      fact: 'Druck',
      pattern: 'Morgens',
      selfRegulation: 'Waerme',
    });
    const diff = computeDiff(makeParseResult({ observations: [incoming] }), {
      observations: [existing],
      supplements: [],
    });
    expect(diff.observations.unchanged).toHaveLength(1);
    expect(diff.observations.changed).toHaveLength(0);
  });

  it('multi-match: picks the most recently updated observation', () => {
    const older = makeExistingObs('Schulter', { id: 'older', updatedAt: 1, status: 'Alt' });
    const newer = makeExistingObs('Schulter', { id: 'newer', updatedAt: 1_000_000, status: 'Alt' });
    const incoming = makeIncomingObs('Schulter', { status: 'Neu' });
    const diff = computeDiff(makeParseResult({ observations: [incoming] }), {
      observations: [older, newer],
      supplements: [],
    });
    expect(diff.observations.changed).toHaveLength(1);
    expect(diff.observations.changed[0]?.existing.id).toBe('newer');
  });

  it('multi-match: emits a warning when multiple candidates were updated within the last 7 days', () => {
    const now = Date.now();
    const a = makeExistingObs('Schulter', { id: 'a', updatedAt: now - 1_000 });
    const b = makeExistingObs('Schulter', { id: 'b', updatedAt: now - 2_000 });
    const diff = computeDiff(
      makeParseResult({ observations: [makeIncomingObs('Schulter', { status: 'Neu' })] }),
      { observations: [a, b], supplements: [] },
    );
    expect(diff.warnings).toHaveLength(1);
    expect(diff.warnings[0]).toMatchObject({
      kind: 'multi-match-observation',
      theme: 'Schulter',
    });
    expect(diff.warnings[0]?.message).toMatch(/Mehrere Beobachtungen mit Thema "Schulter"/);
  });

  it('multi-match: no warning when only one candidate is recent', () => {
    const now = Date.now();
    const stale = makeExistingObs('Schulter', {
      id: 'stale',
      updatedAt: now - 30 * 24 * 60 * 60 * 1000,
    });
    const recent = makeExistingObs('Schulter', { id: 'recent', updatedAt: now - 1000 });
    const diff = computeDiff(
      makeParseResult({ observations: [makeIncomingObs('Schulter', { status: 'Neu' })] }),
      { observations: [stale, recent], supplements: [] },
    );
    expect(diff.warnings).toEqual([]);
    expect(diff.observations.changed[0]?.existing.id).toBe('recent');
  });

  it('matches supplements by name and applies field merge', () => {
    const existing = makeExistingSupplement('Magnesium 400', {
      category: 'daily',
      recommendation: 'Morgens',
    });
    const incoming = makeIncomingSupplement('Magnesium 400', { category: 'paused' });
    const diff = computeDiff(makeParseResult({ supplements: [incoming] }), {
      observations: [],
      supplements: [existing],
    });
    expect(diff.supplements.changed).toHaveLength(1);
    const change = diff.supplements.changed[0];
    expect(change?.merged.category).toBe('paused');
    expect(change?.merged.recommendation).toBe('Morgens');
    expect(change?.fieldsChanged).toEqual(['category']);
  });

  it('always places parsed open points in new (no dedup)', () => {
    const incoming: ParsedOpenPoint[] = [
      makeIncomingOpenPoint('TSH-Wert nachmessen'),
      makeIncomingOpenPoint('MRT Knie'),
    ];
    const diff = computeDiff(makeParseResult({ openPoints: incoming }), {
      observations: [],
      supplements: [],
    });
    expect(diff.openPoints.new).toHaveLength(2);
  });

  it('mixed diff: some new, some changed, some unchanged, some supplements, some open points', () => {
    const existing: Observation[] = [
      makeExistingObs('Linke Schulter', { status: 'Chronisch' }),
      makeExistingObs('Knie links', {
        status: 'Stabil',
        fact: 'unchanged',
        pattern: 'unchanged',
        selfRegulation: 'unchanged',
      }),
    ];
    const existingSup: Supplement[] = [makeExistingSupplement('Magnesium 400')];
    const parse = makeParseResult({
      observations: [
        makeIncomingObs('Linke Schulter', { status: 'Stabil' }), // changed
        makeIncomingObs('Knie rechts', { status: 'Akut' }), // new
        makeIncomingObs('Knie links', {
          status: 'Stabil',
          fact: 'unchanged',
          pattern: 'unchanged',
          selfRegulation: 'unchanged',
        }), // unchanged
      ],
      supplements: [
        makeIncomingSupplement('Omega-3', { category: 'daily' }), // new
        makeIncomingSupplement('Magnesium 400', { category: 'paused' }), // changed
      ],
      openPoints: [makeIncomingOpenPoint('TSH-Wert nachmessen')],
    });

    const diff = computeDiff(parse, { observations: existing, supplements: existingSup });

    expect(diff.observations.new.map((o) => o.theme)).toEqual(['Knie rechts']);
    expect(diff.observations.changed.map((c) => c.existing.theme)).toEqual(['Linke Schulter']);
    expect(diff.observations.unchanged.map((o) => o.theme)).toEqual(['Knie links']);
    expect(diff.supplements.new.map((s) => s.name)).toEqual(['Omega-3']);
    expect(diff.supplements.changed.map((c) => c.existing.name)).toEqual(['Magnesium 400']);
    expect(diff.openPoints.new).toHaveLength(1);
  });

  it('empty parse result produces empty buckets and no warnings', () => {
    const diff = computeDiff(makeParseResult(), { observations: [], supplements: [] });
    expect(diff.observations.new).toEqual([]);
    expect(diff.observations.changed).toEqual([]);
    expect(diff.observations.unchanged).toEqual([]);
    expect(diff.supplements.new).toEqual([]);
    expect(diff.openPoints.new).toEqual([]);
    expect(diff.warnings).toEqual([]);
  });

  describe('diffItemCount', () => {
    it('sums new + changed across all entity types', () => {
      const diff = computeDiff(
        makeParseResult({
          observations: [makeIncomingObs('A'), makeIncomingObs('B')],
          supplements: [makeIncomingSupplement('S1')],
          openPoints: [makeIncomingOpenPoint('P1'), makeIncomingOpenPoint('P2')],
        }),
        { observations: [], supplements: [] },
      );
      expect(diffItemCount(diff)).toBe(5);
    });

    it('returns 0 for an all-unchanged diff', () => {
      const existing = makeExistingObs('X', {
        status: 'a',
        fact: 'b',
        pattern: 'c',
        selfRegulation: 'd',
      });
      const diff = computeDiff(
        makeParseResult({
          observations: [
            makeIncomingObs('X', { status: 'a', fact: 'b', pattern: 'c', selfRegulation: 'd' }),
          ],
        }),
        { observations: [existing], supplements: [] },
      );
      expect(diffItemCount(diff)).toBe(0);
    });
  });
});
