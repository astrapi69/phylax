/**
 * IM-06 field-level merge: natural-key extractors.
 *
 * Each entity type has a user-visible identifier that two rows
 * "are obviously the same" on. Merge-time matching reduces an
 * entity to its key string; equal keys mean the same logical
 * entity from the user's point of view.
 *
 * Spec: docs/specs/IM-06-field-level-merge.md
 *
 * v1 limitation (W1 in spec): byte-equal match only. Whitespace,
 * punctuation, or capitalisation variants do NOT collapse - both
 * stay as New. Acceptable trade-off for v1; future Q3 normalisation
 * work addresses if false-negatives surface.
 */

import type {
  Observation,
  LabReport,
  Supplement,
  OpenPoint,
  ProfileVersion,
  TimelineEntry,
  LabValue,
} from '..';

/**
 * Observation: theme is the visible group label in the
 * `/observations` view and the X-04 export theme filter.
 * Trim removes accidental leading / trailing whitespace.
 */
export function observationKey(o: Pick<Observation, 'theme'>): string {
  return o.theme.trim();
}

/**
 * Lab report: ISO date is the implicit one-per-day invariant
 * already enforced by the parser fixture and the sort UX.
 */
export function labReportKey(r: Pick<LabReport, 'reportDate'>): string {
  return r.reportDate.trim();
}

/**
 * Lab value: scoped to its parent report at match time. Within
 * a single report, parameter is the natural key. The caller is
 * responsible for grouping values under a matched report id
 * before invoking this helper.
 */
export function labValueKey(v: Pick<LabValue, 'parameter'>): string {
  return v.parameter.trim();
}

/**
 * Supplement: name plus brand when present. `Vitamin D3` and
 * `Vitamin D3 (Pure)` are different rows in real fixtures, so
 * brand is part of the identity rather than a non-key field.
 */
export function supplementKey(s: Pick<Supplement, 'name' | 'brand'>): string {
  const name = s.name.trim();
  const brand = s.brand?.trim();
  return brand ? `${name}|${brand}` : name;
}

/**
 * Open-point: context groups bullets in the UI; bullet-level
 * merge is handled separately by `mergeOpenPointsBullets` in the
 * resolution step.
 */
export function openPointKey(p: Pick<OpenPoint, 'context'>): string {
  return p.context.trim();
}

/**
 * Profile-version: the semantic version label is the user-visible
 * row identity. Two rows with the same `version` are the same
 * version entry; differing change descriptions surface as a conflict.
 */
export function profileVersionKey(v: Pick<ProfileVersion, 'version'>): string {
  return v.version.trim();
}

/**
 * Timeline entry: `period` is the time-period label
 * (e.g. "Dezember 2024", "März 2026"). Spec mentions ISO date but
 * the entity's actual field is the period label. Identical periods
 * with different titles or content surface as conflicts.
 */
export function timelineEntryKey(t: Pick<TimelineEntry, 'period' | 'title'>): string {
  // `period` alone collides on real profiles where multiple events
  // happen in the same month (e.g. two "März 2026" entries with
  // different titles). Compose period + title so the user-meaningful
  // pair is the identity.
  return `${t.period.trim()}|${t.title.trim()}`;
}
