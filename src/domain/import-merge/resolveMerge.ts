/**
 * IM-06 field-level merge: resolve match outcomes + user choices
 * into a write plan.
 *
 * Pure transform. No DB, no React, no encryption. Consumes the
 * `MergeMatch[]` output of `matchEntities` plus the user's
 * `ConflictResolution` choices and produces a per-type
 * `MergePlan` consisting of:
 *
 *   - `inserts`: parsed entities to write fresh (outcome 'new').
 *   - `updates`: existing entities to patch (outcome 'conflict'
 *     resolved with `theirs` or `field-by-field`-with-some-theirs).
 *
 * Notably absent: `deletes`. Field-level merge NEVER destroys
 * existing data - existing rows that had no parsed counterpart
 * stay untouched (the matchEntities output skips them; this
 * resolver therefore can't see them; the storage layer only
 * applies the plan, not absent diffs). See watchpoints W1 and
 * spec section "Match outcomes" for the full invariant set.
 */

import type {
  ConflictResolution,
  FieldDiff,
  MergeEntity,
  MergeMatch,
  MergeableEntityKey,
} from './types';

/**
 * One update directive: patch the entity with `existingId` such
 * that the listed fields take their new (theirs) values.
 *
 * `patch` only contains the fields that change. Fields the user
 * picked Mine for are absent from the patch and stay at their
 * existing value (no-op for those keys).
 */
export interface EntityUpdate<K extends MergeableEntityKey> {
  existingId: string;
  patch: Partial<MergeEntity<K>>;
}

/**
 * Per-type merge plan: the inputs the storage layer needs to
 * commit the merge in a single Dexie transaction.
 */
export interface MergePlan<K extends MergeableEntityKey> {
  inserts: MergeEntity<K>[];
  updates: EntityUpdate<K>[];
}

/**
 * Map keyed by the existing-row id of the `MergeMatch<K>` of
 * outcome 'conflict' that produced it. The conflict-resolution
 * UI iterates the conflict-bucket of every type to render its
 * pickers; the user's choice is stored back under the same key
 * here. Q2 invariant: every `conflict` match MUST have a
 * resolution entry by the time `resolveMerge` runs - the UI
 * disables Confirm until that holds.
 */
export type ResolutionMap<K extends MergeableEntityKey> = Record<string, ConflictResolution<K>>;

/**
 * Throws when a 'conflict' match has no resolution entry. Caller
 * bug, never user-facing - the UI prevents confirm until every
 * conflict has a pick (Q2 lock).
 */
export class UnresolvedConflictError extends Error {
  readonly entityKind: MergeableEntityKey;
  readonly existingId: string;
  constructor(entityKind: MergeableEntityKey, existingId: string) {
    super(`Unresolved conflict on ${entityKind} id=${existingId}`);
    this.name = 'UnresolvedConflictError';
    this.entityKind = entityKind;
    this.existingId = existingId;
  }
}

/**
 * Build a `MergePlan` for one entity type from its match list and
 * the user's resolutions.
 *
 *   - 'new'        -> push to `inserts` (full parsed entity).
 *   - 'identical'  -> no-op (existing already matches).
 *   - 'conflict'   -> consult `resolutions[match.existing.id]`:
 *       - 'mine'             -> no-op (preserve existing as-is).
 *       - 'theirs'           -> patch = ALL diff fields with theirs.
 *       - 'field-by-field'   -> patch = diff fields where the user
 *         picked 'theirs'; fields picked 'mine' are excluded
 *         (preserve existing).
 *
 * Throws `UnresolvedConflictError` on a missing resolution entry
 * for a 'conflict' match.
 */
export function resolveMerge<K extends MergeableEntityKey>(
  matches: MergeMatch<K>[],
  resolutions: ResolutionMap<K>,
): MergePlan<K> {
  const inserts: MergeEntity<K>[] = [];
  const updates: EntityUpdate<K>[] = [];

  for (const m of matches) {
    if (m.outcome === 'new') {
      inserts.push(m.parsed);
      continue;
    }
    if (m.outcome === 'identical') {
      continue;
    }
    // outcome === 'conflict'
    const resolution = resolutions[m.existing.id];
    if (!resolution) {
      throw new UnresolvedConflictError(m.kind, m.existing.id);
    }
    // Q2 discipline: when the user picked field-by-field, every
    // field in this conflict's diff array must have an explicit
    // mine/theirs entry. A missing entry is a UI bug, not a
    // legitimate "no opinion" - throw the same error class as
    // the missing-resolution case so the UI surfaces a developer
    // diagnostic instead of silently picking a default.
    if (resolution.kind === 'field-by-field') {
      for (const d of m.diffs) {
        if (resolution.fieldChoices[d.field] === undefined) {
          throw new UnresolvedConflictError(m.kind, m.existing.id);
        }
      }
    }
    const patch = buildPatch<K>(m.diffs, resolution);
    if (Object.keys(patch).length === 0) {
      // 'mine' on every diff -> nothing to write.
      continue;
    }
    updates.push({ existingId: m.existing.id, patch });
  }

  return { inserts, updates };
}

/**
 * Compose the patch object for one conflict match given the
 * resolution choice. Only fields where the user picked 'theirs'
 * appear in the result; 'mine' fields are absent (existing
 * preserved).
 */
function buildPatch<K extends MergeableEntityKey>(
  diffs: FieldDiff<K>[],
  resolution: ConflictResolution<K>,
): Partial<MergeEntity<K>> {
  const patch: Record<string, unknown> = {};
  if (resolution.kind === 'mine') {
    return {} as Partial<MergeEntity<K>>;
  }
  if (resolution.kind === 'theirs') {
    for (const d of diffs) {
      patch[d.field] = d.theirsValue;
    }
    return patch as Partial<MergeEntity<K>>;
  }
  // field-by-field. By the time this runs, the caller (resolveMerge)
  // has already validated that every field in `diffs` has an explicit
  // entry in `fieldChoices` and thrown UnresolvedConflictError if not
  // (Q2 discipline). A `'mine'` choice produces no patch entry and
  // therefore preserves the existing value; only `'theirs'` writes.
  //
  // Note on "missing key" semantics: fields that were NOT in the
  // diff-array at all (i.e. the field was already equal between
  // existing and parsed, or the parsed side had no opinion per
  // watchpoint #5) never enter this loop. Those fields trivially
  // stay at their existing value because they never appear in any
  // patch. This is the legitimate "fall back to mine" case for
  // non-conflicting fields, distinct from the UI-bug case (a field
  // IS in conflict but the UI failed to collect a pick) which
  // throws above.
  for (const d of diffs) {
    const choice = resolution.fieldChoices[d.field];
    if (choice === 'theirs') {
      patch[d.field] = d.theirsValue;
    }
  }
  return patch as Partial<MergeEntity<K>>;
}

/**
 * Total counts across a plan. Useful for the success-screen
 * summary and for tests.
 */
export function planCounts<K extends MergeableEntityKey>(
  plan: MergePlan<K>,
): { inserts: number; updates: number } {
  return { inserts: plan.inserts.length, updates: plan.updates.length };
}
