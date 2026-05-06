/**
 * IM-06 field-level merge: domain types.
 *
 * Pure data shapes for the natural-key match + field-diff pipeline.
 * No React, no Dexie, no encryption. Consumers in the storage layer
 * apply the resulting `MergePlan` against the repositories.
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

/**
 * Entity types eligible for field-level merge.
 *
 * Profile identity data (BaseData / warningSigns / externalReferences)
 * is NEVER merged via this engine - it is always handled separately by
 * `mergeProfile()` in the import pipeline (Q5 invariant from IM-05).
 */
export type MergeableEntityKey =
  | 'observations'
  | 'labReports'
  | 'labValues'
  | 'supplements'
  | 'openPoints'
  | 'profileVersions'
  | 'timelineEntries';

/**
 * Map from entity key to its concrete domain type. Lets generic helpers
 * stay typed across the seven entity flavours.
 */
export interface MergeEntityMap {
  observations: Observation;
  labReports: LabReport;
  labValues: LabValue;
  supplements: Supplement;
  openPoints: OpenPoint;
  profileVersions: ProfileVersion;
  timelineEntries: TimelineEntry;
}

export type MergeEntity<K extends MergeableEntityKey> = MergeEntityMap[K];

/**
 * Outcome bucket for a single parsed entity matched against the
 * existing entity set:
 *
 * - `new`: no existing row matched on the natural key. Insert as-is.
 * - `identical`: matched on natural key AND every other field equal.
 *   No-op (do not write a duplicate).
 * - `conflict`: matched on natural key BUT at least one other field
 *   differs. Routes to the conflict-resolution UX.
 */
export type MatchOutcome = 'new' | 'identical' | 'conflict';

/**
 * One field-level difference between an existing row and a parsed row
 * that share the same natural key.
 */
export interface FieldDiff<K extends MergeableEntityKey> {
  /** Field name on the entity. Stringly typed so the resolution UI can render it dynamically. */
  field: keyof MergeEntity<K> & string;
  /** Existing (in-DB) value. May be `undefined` when the field was unset. */
  mineValue: unknown;
  /** Parsed (incoming) value. May be `undefined` when the field is unset on the import side. */
  theirsValue: unknown;
}

/**
 * The result of matching one parsed entity against the existing pool.
 *
 * Generic discriminated union: the `outcome` discriminant tells the
 * consumer which other fields are populated.
 */
export type MergeMatch<K extends MergeableEntityKey> =
  | {
      outcome: 'new';
      kind: K;
      parsed: MergeEntity<K>;
    }
  | {
      outcome: 'identical';
      kind: K;
      parsed: MergeEntity<K>;
      existing: MergeEntity<K>;
    }
  | {
      outcome: 'conflict';
      kind: K;
      parsed: MergeEntity<K>;
      existing: MergeEntity<K>;
      diffs: FieldDiff<K>[];
    };

/**
 * Per-conflict resolution choice. Applied by `resolveMerge` in the
 * next step of the pipeline.
 *
 * - `mine`: keep the existing row unchanged for every differing field.
 * - `theirs`: overwrite every differing field with the parsed value.
 * - `field-by-field`: per-field choice via `fieldChoices` (one entry
 *   per `FieldDiff`). Missing entries fall back to `'mine'` -
 *   defensive default rather than implicit `'theirs'`, but the UI
 *   should require an explicit pick per Q2 lock.
 */
export type ConflictResolution<K extends MergeableEntityKey> =
  | { kind: 'mine' }
  | { kind: 'theirs' }
  | {
      kind: 'field-by-field';
      // Partial: only the fields that appear in the matching
      // `FieldDiff[]` need an entry. Missing fields fall back to
      // 'mine' inside `resolveMerge`.
      fieldChoices: Partial<Record<keyof MergeEntity<K> & string, 'mine' | 'theirs'>>;
    };

/**
 * Output of `matchEntities`: every parsed entity bucketed by outcome,
 * pre-grouped by entity kind so the resolution UI can render
 * one section per kind.
 */
export type MergeMatchSet = {
  [K in MergeableEntityKey]: MergeMatch<K>[];
};

/**
 * Per-entity-type resolution map shape. `ResolutionMap<K>` is
 * defined in `resolveMerge.ts` as a `Record<existingId,
 * ConflictResolution<K>>`; replicated here as a structural
 * dependency so consumers (`features/profile-import/import/types.ts`
 * `ImportOptions.resolutions`) avoid a circular import via the
 * resolveMerge module.
 *
 * Each field is optional: callers only populate the entity types
 * that have at least one conflict to resolve. Empty / absent =
 * no resolutions provided for that type.
 */
export interface MergeResolutions {
  observations?: Record<string, ConflictResolution<'observations'>>;
  labReports?: Record<string, ConflictResolution<'labReports'>>;
  labValues?: Record<string, ConflictResolution<'labValues'>>;
  supplements?: Record<string, ConflictResolution<'supplements'>>;
  openPoints?: Record<string, ConflictResolution<'openPoints'>>;
  profileVersions?: Record<string, ConflictResolution<'profileVersions'>>;
  timelineEntries?: Record<string, ConflictResolution<'timelineEntries'>>;
}
