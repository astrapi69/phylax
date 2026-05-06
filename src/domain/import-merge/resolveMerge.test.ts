import { describe, it, expect } from 'vitest';
import type { Observation, OpenPoint } from '..';
import type { MergeMatch } from './types';
import {
  resolveMerge,
  planCounts,
  UnresolvedConflictError,
  type ResolutionMap,
} from './resolveMerge';

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

function makeOpenPoint(overrides: Partial<OpenPoint> = {}): OpenPoint {
  return {
    id: 'op-existing-1',
    profileId: PROFILE_ID,
    createdAt: 1,
    updatedAt: 2,
    text: 'Wasser trinken',
    context: 'Blutabnahme',
    resolved: false,
    ...overrides,
  };
}

describe('resolveMerge - new outcomes', () => {
  it('outcome=new -> push parsed entity into inserts', () => {
    const parsed = makeObservation({ id: 'parsed-1', theme: 'Hüfte' });
    const matches: MergeMatch<'observations'>[] = [
      { outcome: 'new', kind: 'observations', parsed },
    ];
    const plan = resolveMerge(matches, {});
    expect(plan.inserts).toEqual([parsed]);
    expect(plan.updates).toEqual([]);
  });

  it('multiple new entities all bucket into inserts in input order', () => {
    const a = makeObservation({ id: 'p-1', theme: 'A' });
    const b = makeObservation({ id: 'p-2', theme: 'B' });
    const matches: MergeMatch<'observations'>[] = [
      { outcome: 'new', kind: 'observations', parsed: a },
      { outcome: 'new', kind: 'observations', parsed: b },
    ];
    const plan = resolveMerge(matches, {});
    expect(plan.inserts.map((o) => o.theme)).toEqual(['A', 'B']);
  });
});

describe('resolveMerge - identical outcomes', () => {
  it('outcome=identical -> no-op (no insert, no update)', () => {
    const existing = makeObservation();
    const parsed = makeObservation({ id: 'parsed-1' });
    const matches: MergeMatch<'observations'>[] = [
      { outcome: 'identical', kind: 'observations', parsed, existing },
    ];
    const plan = resolveMerge(matches, {});
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([]);
  });
});

describe('resolveMerge - conflict resolution: mine', () => {
  it("kind='mine' -> no update, existing preserved", () => {
    const existing = makeObservation({ fact: 'mine' });
    const parsed = makeObservation({ fact: 'theirs', id: 'parsed-1' });
    const matches: MergeMatch<'observations'>[] = [
      {
        outcome: 'conflict',
        kind: 'observations',
        parsed,
        existing,
        diffs: [{ field: 'fact', mineValue: 'mine', theirsValue: 'theirs' }],
      },
    ];
    const resolutions: ResolutionMap<'observations'> = {
      [existing.id]: { kind: 'mine' },
    };
    const plan = resolveMerge(matches, resolutions);
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([]);
  });
});

describe('resolveMerge - conflict resolution: theirs', () => {
  it("kind='theirs' -> patch contains every diff field with theirs values", () => {
    const existing = makeObservation({ fact: 'mine-fact', status: 'mine-status' });
    const parsed = makeObservation({
      fact: 'theirs-fact',
      status: 'theirs-status',
      id: 'parsed-1',
    });
    const matches: MergeMatch<'observations'>[] = [
      {
        outcome: 'conflict',
        kind: 'observations',
        parsed,
        existing,
        diffs: [
          { field: 'fact', mineValue: 'mine-fact', theirsValue: 'theirs-fact' },
          { field: 'status', mineValue: 'mine-status', theirsValue: 'theirs-status' },
        ],
      },
    ];
    const resolutions: ResolutionMap<'observations'> = {
      [existing.id]: { kind: 'theirs' },
    };
    const plan = resolveMerge(matches, resolutions);
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]?.existingId).toBe('obs-existing-1');
    expect(plan.updates[0]?.patch).toEqual({
      fact: 'theirs-fact',
      status: 'theirs-status',
    });
  });
});

describe('resolveMerge - conflict resolution: field-by-field', () => {
  it('per-field theirs picks land in the patch; mine picks are excluded', () => {
    const existing = makeObservation({ fact: 'mine-fact', status: 'mine-status' });
    const parsed = makeObservation({
      fact: 'theirs-fact',
      status: 'theirs-status',
      id: 'parsed-1',
    });
    const matches: MergeMatch<'observations'>[] = [
      {
        outcome: 'conflict',
        kind: 'observations',
        parsed,
        existing,
        diffs: [
          { field: 'fact', mineValue: 'mine-fact', theirsValue: 'theirs-fact' },
          { field: 'status', mineValue: 'mine-status', theirsValue: 'theirs-status' },
        ],
      },
    ];
    const resolutions: ResolutionMap<'observations'> = {
      [existing.id]: {
        kind: 'field-by-field',
        fieldChoices: { fact: 'theirs', status: 'mine' },
      },
    };
    const plan = resolveMerge(matches, resolutions);
    expect(plan.updates[0]?.patch).toEqual({ fact: 'theirs-fact' });
    expect('status' in (plan.updates[0]?.patch ?? {})).toBe(false);
  });

  it('field-by-field with every field picked mine collapses to no update', () => {
    const existing = makeObservation({ fact: 'a' });
    const parsed = makeObservation({ fact: 'b', id: 'parsed-1' });
    const matches: MergeMatch<'observations'>[] = [
      {
        outcome: 'conflict',
        kind: 'observations',
        parsed,
        existing,
        diffs: [{ field: 'fact', mineValue: 'a', theirsValue: 'b' }],
      },
    ];
    const resolutions: ResolutionMap<'observations'> = {
      [existing.id]: {
        kind: 'field-by-field',
        fieldChoices: { fact: 'mine' },
      },
    };
    const plan = resolveMerge(matches, resolutions);
    expect(plan.updates).toEqual([]);
  });

  it('missing per-field pick on a conflicting field throws (Q2 discipline, UI bug)', () => {
    // Distinct from "field NOT in diff-array" (legitimate fall-back-to-mine
    // for non-conflicting fields). Here `status` IS in the diff array but
    // the resolution map omits its choice - that means the UI failed to
    // collect a pick and we surface the diagnostic instead of silently
    // defaulting.
    const existing = makeObservation({ fact: 'a', status: 'x' });
    const parsed = makeObservation({ fact: 'b', status: 'y', id: 'parsed-1' });
    const matches: MergeMatch<'observations'>[] = [
      {
        outcome: 'conflict',
        kind: 'observations',
        parsed,
        existing,
        diffs: [
          { field: 'fact', mineValue: 'a', theirsValue: 'b' },
          { field: 'status', mineValue: 'x', theirsValue: 'y' },
        ],
      },
    ];
    const resolutions: ResolutionMap<'observations'> = {
      [existing.id]: {
        kind: 'field-by-field',
        // status intentionally absent. The diff-array contains it,
        // so this MUST throw rather than fall back silently.
        fieldChoices: { fact: 'theirs' },
      },
    };
    expect(() => resolveMerge(matches, resolutions)).toThrow(UnresolvedConflictError);
  });
});

describe('resolveMerge - missing resolution', () => {
  it("throws UnresolvedConflictError when a 'conflict' match has no resolution entry", () => {
    const existing = makeObservation();
    const parsed = makeObservation({ id: 'parsed-1', fact: 'x' });
    const matches: MergeMatch<'observations'>[] = [
      {
        outcome: 'conflict',
        kind: 'observations',
        parsed,
        existing,
        diffs: [{ field: 'fact', mineValue: 'Schmerz bei Belastung.', theirsValue: 'x' }],
      },
    ];
    expect(() => resolveMerge(matches, {})).toThrow(UnresolvedConflictError);
  });
});

describe('resolveMerge - watchpoints', () => {
  it('absent entity case: existing-only rows produce nothing in the plan (preserved by storage)', () => {
    // matchEntities only emits matches for parsed inputs. resolveMerge
    // therefore can't see existing-only rows. Storage layer applies
    // inserts + updates only; existing rows not in either slice keep
    // their state. Watchpoint #1.
    const matches: MergeMatch<'observations'>[] = [];
    const plan = resolveMerge(matches, {});
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([]);
  });

  it('mixed batch: new + identical + conflict-theirs all flow correctly', () => {
    const existingConflict = makeObservation({
      id: 'obs-existing-conflict',
      theme: 'Schulter',
      fact: 'old',
    });
    const existingIdentical = makeObservation({
      id: 'obs-existing-identical',
      theme: 'Knie',
      fact: 'same',
    });
    const matches: MergeMatch<'observations'>[] = [
      {
        outcome: 'new',
        kind: 'observations',
        parsed: makeObservation({ id: 'parsed-new', theme: 'Hüfte' }),
      },
      {
        outcome: 'identical',
        kind: 'observations',
        parsed: makeObservation({ id: 'parsed-id', theme: 'Knie', fact: 'same' }),
        existing: existingIdentical,
      },
      {
        outcome: 'conflict',
        kind: 'observations',
        parsed: makeObservation({ id: 'parsed-c', theme: 'Schulter', fact: 'new' }),
        existing: existingConflict,
        diffs: [{ field: 'fact', mineValue: 'old', theirsValue: 'new' }],
      },
    ];
    const resolutions: ResolutionMap<'observations'> = {
      [existingConflict.id]: { kind: 'theirs' },
    };
    const plan = resolveMerge(matches, resolutions);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]?.theme).toBe('Hüfte');
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]?.existingId).toBe('obs-existing-conflict');
    expect(plan.updates[0]?.patch).toEqual({ fact: 'new' });
  });

  it('open-points work the same way under composite-key matching', () => {
    // Sanity: same algorithm applies to OpenPoint as to Observation.
    const existing = makeOpenPoint({ priority: 'Hoch' });
    const parsed = makeOpenPoint({ priority: 'Mittel', id: 'parsed-1' });
    const matches: MergeMatch<'openPoints'>[] = [
      {
        outcome: 'conflict',
        kind: 'openPoints',
        parsed,
        existing,
        diffs: [{ field: 'priority', mineValue: 'Hoch', theirsValue: 'Mittel' }],
      },
    ];
    const resolutions: ResolutionMap<'openPoints'> = {
      [existing.id]: { kind: 'theirs' },
    };
    const plan = resolveMerge(matches, resolutions);
    expect(plan.updates[0]?.patch).toEqual({ priority: 'Mittel' });
  });
});

describe('planCounts', () => {
  it('tallies inserts + updates lengths', () => {
    const plan = {
      inserts: [makeObservation({ id: 'a' }), makeObservation({ id: 'b' })],
      updates: [{ existingId: 'x', patch: { fact: 'y' } }],
    };
    expect(planCounts(plan)).toEqual({ inserts: 2, updates: 1 });
  });

  it('zero / zero on an empty plan', () => {
    expect(planCounts({ inserts: [], updates: [] })).toEqual({ inserts: 0, updates: 0 });
  });
});

describe('UnresolvedConflictError fields', () => {
  it('carries entityKind + existingId for caller diagnostics', () => {
    const err = new UnresolvedConflictError('observations', 'obs-X');
    expect(err.name).toBe('UnresolvedConflictError');
    expect(err.entityKind).toBe('observations');
    expect(err.existingId).toBe('obs-X');
    expect(err.message).toContain('obs-X');
  });
});
