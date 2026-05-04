/**
 * IM-06 field-level merge: bucket parsed entities into
 * new / identical / conflict against the existing pool.
 *
 * Pure functions. No DB, no React, no encryption.
 *
 * Algorithm per entity type:
 *   1. Build a `Map<key, existing>` from the existing array.
 *   2. For each parsed entity:
 *        a. Extract its natural key.
 *        b. If no existing entry under the key -> outcome 'new'.
 *        c. Else compute field diffs ignoring DomainEntity-managed
 *           bookkeeping fields (id, profileId, createdAt, updatedAt).
 *        d. Empty diff list -> 'identical', no-op.
 *        e. Non-empty -> 'conflict' with the diff list.
 *
 * Lab values are special: their natural key is parameter, but the
 * key is only meaningful within a matched lab report. Callers must
 * group lab values under the correctly-matched parent report id
 * before invoking `matchLabValues` (or use the `matchAll` wrapper
 * which handles the dependency).
 */

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
  observationKey,
  labReportKey,
  labValueKey,
  supplementKey,
  openPointKey,
  profileVersionKey,
  timelineEntryKey,
} from './naturalKey';
import type { FieldDiff, MatchOutcome, MergeEntity, MergeMatch, MergeableEntityKey } from './types';

/**
 * Bookkeeping fields skipped during conflict-detection. They are
 * assigned by the storage layer (id, createdAt, updatedAt) or by
 * the caller (profileId), so a parsed entity will never have them
 * matching its existing counterpart by accident.
 *
 * `reportId` is a foreign key on LabValue. Within
 * `matchLabValuesPerReport`, the caller already groups parsed
 * values under the matched parent report - comparing reportId
 * would be a false-positive conflict by construction (parsed
 * values carry their own placeholder id, existing values carry
 * the persisted parent's id).
 *
 * `reportIndex` is on ParsedLabValue only (positional pointer to
 * the parsed-reports array, irrelevant once the parent has been
 * matched). Skip defensively in case a typed-cast lab value still
 * carries it.
 */
const SKIP_FIELDS = new Set([
  'id',
  'profileId',
  'createdAt',
  'updatedAt',
  'reportId',
  'reportIndex',
]);

/**
 * Generic bucketer: matches one parsed entity against an
 * already-built lookup map keyed by natural-key string.
 */
function classify<K extends MergeableEntityKey>(
  kind: K,
  parsed: MergeEntity<K>,
  existingByKey: Map<string, MergeEntity<K>>,
  keyOf: (e: MergeEntity<K>) => string,
): MergeMatch<K> {
  const key = keyOf(parsed);
  const existing = existingByKey.get(key);
  if (!existing) {
    return { outcome: 'new' as const, kind, parsed };
  }
  const diffs = diffFields<K>(existing, parsed);
  if (diffs.length === 0) {
    return { outcome: 'identical' as const, kind, parsed, existing };
  }
  return { outcome: 'conflict' as const, kind, parsed, existing, diffs };
}

/**
 * Field-by-field diff: returns the list of fields where existing
 * and parsed differ. Skips the `SKIP_FIELDS` bookkeeping set.
 *
 * Comparison is `===` for primitives and structural for arrays /
 * plain objects. Arrays compare element-wise; objects compare via
 * stringified JSON (good enough for the small extraSections /
 * categoryAssessments maps that show up in our entities, and
 * deterministic since key order is preserved by the parser).
 */
function diffFields<K extends MergeableEntityKey>(
  existing: MergeEntity<K>,
  parsed: MergeEntity<K>,
): FieldDiff<K>[] {
  const diffs: FieldDiff<K>[] = [];
  const keys = new Set<string>([
    ...Object.keys(existing as unknown as Record<string, unknown>),
    ...Object.keys(parsed as unknown as Record<string, unknown>),
  ]);
  for (const k of keys) {
    if (SKIP_FIELDS.has(k)) continue;
    const a = (existing as unknown as Record<string, unknown>)[k];
    const b = (parsed as unknown as Record<string, unknown>)[k];
    if (!valuesEqual(a, b)) {
      diffs.push({
        field: k as keyof MergeEntity<K> & string,
        mineValue: a,
        theirsValue: b,
      });
    }
  }
  return diffs;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!valuesEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    // Plain-object structural compare. Sort keys to make the
    // serialization stable across {a:1,b:2} vs {b:2,a:1}.
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao).sort();
    const bk = Object.keys(bo).sort();
    if (ak.length !== bk.length) return false;
    for (let i = 0; i < ak.length; i++) {
      if (ak[i] !== bk[i]) return false;
    }
    for (const k of ak) {
      if (!valuesEqual(ao[k], bo[k])) return false;
    }
    return true;
  }
  return false;
}

/**
 * Per-entity-type matchers. Each builds a lookup of existing rows
 * keyed by natural-key string and classifies each parsed row.
 */

export function matchObservations(
  existing: Observation[],
  parsed: Observation[],
): MergeMatch<'observations'>[] {
  const lookup = new Map<string, Observation>();
  for (const e of existing) lookup.set(observationKey(e), e);
  return parsed.map((p) => classify('observations', p, lookup, observationKey));
}

export function matchLabReports(
  existing: LabReport[],
  parsed: LabReport[],
): MergeMatch<'labReports'>[] {
  const lookup = new Map<string, LabReport>();
  for (const e of existing) lookup.set(labReportKey(e), e);
  return parsed.map((p) => classify('labReports', p, lookup, labReportKey));
}

export function matchSupplements(
  existing: Supplement[],
  parsed: Supplement[],
): MergeMatch<'supplements'>[] {
  const lookup = new Map<string, Supplement>();
  for (const e of existing) lookup.set(supplementKey(e), e);
  return parsed.map((p) => classify('supplements', p, lookup, supplementKey));
}

export function matchOpenPoints(
  existing: OpenPoint[],
  parsed: OpenPoint[],
): MergeMatch<'openPoints'>[] {
  const lookup = new Map<string, OpenPoint>();
  for (const e of existing) lookup.set(openPointKey(e), e);
  return parsed.map((p) => classify('openPoints', p, lookup, openPointKey));
}

export function matchProfileVersions(
  existing: ProfileVersion[],
  parsed: ProfileVersion[],
): MergeMatch<'profileVersions'>[] {
  const lookup = new Map<string, ProfileVersion>();
  for (const e of existing) lookup.set(profileVersionKey(e), e);
  return parsed.map((p) => classify('profileVersions', p, lookup, profileVersionKey));
}

export function matchTimelineEntries(
  existing: TimelineEntry[],
  parsed: TimelineEntry[],
): MergeMatch<'timelineEntries'>[] {
  const lookup = new Map<string, TimelineEntry>();
  for (const e of existing) lookup.set(timelineEntryKey(e), e);
  return parsed.map((p) => classify('timelineEntries', p, lookup, timelineEntryKey));
}

/**
 * Lab values: `parameter` is unique only within a single report.
 * The caller groups parsed values under the matched parent report id
 * (or a sentinel for new reports). This helper handles one report at
 * a time; pass an empty `existing` array when the parent report is
 * itself new (every value becomes 'new' too).
 */
export function matchLabValuesWithinReport(
  existing: LabValue[],
  parsed: LabValue[],
): MergeMatch<'labValues'>[] {
  const lookup = new Map<string, LabValue>();
  for (const e of existing) lookup.set(labValueKey(e), e);
  return parsed.map((p) => classify('labValues', p, lookup, labValueKey));
}

/**
 * Helper for callers wiring lab-value matching across multiple
 * reports. Returns one `MergeMatch<'labValues'>[]` slice per parsed
 * report, in input order.
 *
 * `parentReportMatches` is the output of `matchLabReports`. The
 * existing lab values are looked up by their `reportId` against the
 * matched existing report's id; values whose parent is a 'new'
 * report all bucket as 'new'.
 */
export function matchLabValuesPerReport(
  parentReportMatches: MergeMatch<'labReports'>[],
  parsedValues: Array<LabValue & { reportIndex: number }>,
  existingValuesByReportId: Map<string, LabValue[]>,
): MergeMatch<'labValues'>[] {
  const out: MergeMatch<'labValues'>[] = [];
  for (let i = 0; i < parentReportMatches.length; i++) {
    const parentMatch = parentReportMatches[i];
    if (!parentMatch) continue;
    const valuesForThisReport = parsedValues.filter((v) => v.reportIndex === i);
    let existingForReport: LabValue[];
    if (parentMatch.outcome === 'new') {
      existingForReport = [];
    } else {
      existingForReport = existingValuesByReportId.get(parentMatch.existing.id) ?? [];
    }
    out.push(...matchLabValuesWithinReport(existingForReport, valuesForThisReport));
  }
  return out;
}

/**
 * Counts of the three outcomes across a `MergeMatch[]` slice.
 * Useful for the resolution-modal summary header and for tests.
 */
export function countOutcomes<K extends MergeableEntityKey>(
  matches: MergeMatch<K>[],
): Record<MatchOutcome, number> {
  const counts: Record<MatchOutcome, number> = { new: 0, identical: 0, conflict: 0 };
  for (const m of matches) counts[m.outcome] += 1;
  return counts;
}
