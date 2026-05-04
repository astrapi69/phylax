/**
 * IM-06 Step 4 helper: pre-transaction dry-run that detects which
 * parsed entities would surface as 'conflict' outcomes in a merge
 * import.
 *
 * Used by `useImport.startImport` to decide whether to route through
 * the new `'conflict-resolution'` state (collect user picks via the
 * resolution modal) or jump straight to `'importing'` when every
 * merge match resolves as `'new'` or `'identical'`.
 *
 * Atomicity: runs OUTSIDE the import transaction. No writes happen
 * here; the function only loads existing rows and computes the
 * match set in memory. If decryption / load fails the error
 * propagates to the caller, which routes to `'error'` state - the
 * 'conflict-resolution' state is reserved for user-decision
 * conflicts only (W4 lock).
 *
 * Lab values: scoped per matched parent report so cross-report
 * parameter collisions stay independent (W6 from Step 3b).
 */

import type {
  Observation,
  LabReport,
  LabValue,
  Supplement,
  OpenPoint,
  ProfileVersion,
  TimelineEntry,
} from '../../../domain';
import {
  ObservationRepository,
  LabReportRepository,
  LabValueRepository,
  SupplementRepository,
  OpenPointRepository,
  ProfileVersionRepository,
  TimelineEntryRepository,
} from '../../../db/repositories';
import {
  matchObservations,
  matchLabReports,
  matchLabValuesPerReport,
  matchSupplements,
  matchOpenPoints,
  matchProfileVersions,
  matchTimelineEntries,
  type MergeMatch,
} from '../../../domain/import-merge';
import type { ParseResult } from '../parser/types';
import type { ResolvedModeMap } from './types';

/**
 * Conflict-only slice of the match set, grouped by entity type.
 * Each array contains ONLY matches with `outcome === 'conflict'`;
 * 'new' and 'identical' outcomes are filtered out because they
 * never need a user decision.
 *
 * Each entry preserves the matching `existing` entity + its `diffs`
 * so the resolution UI can render the per-conflict picker without
 * re-running the matcher.
 */
export interface MergeConflictSet {
  observations: Extract<MergeMatch<'observations'>, { outcome: 'conflict' }>[];
  labReports: Extract<MergeMatch<'labReports'>, { outcome: 'conflict' }>[];
  labValues: Extract<MergeMatch<'labValues'>, { outcome: 'conflict' }>[];
  supplements: Extract<MergeMatch<'supplements'>, { outcome: 'conflict' }>[];
  openPoints: Extract<MergeMatch<'openPoints'>, { outcome: 'conflict' }>[];
  profileVersions: Extract<MergeMatch<'profileVersions'>, { outcome: 'conflict' }>[];
  timelineEntries: Extract<MergeMatch<'timelineEntries'>, { outcome: 'conflict' }>[];
}

export const EMPTY_CONFLICT_SET: MergeConflictSet = {
  observations: [],
  labReports: [],
  labValues: [],
  supplements: [],
  openPoints: [],
  profileVersions: [],
  timelineEntries: [],
};

/**
 * True when at least one conflict exists across any entity type.
 * Used by the state machine to decide between
 * 'conflict-resolution' and direct-to-'importing'.
 */
export function hasAnyConflict(set: MergeConflictSet): boolean {
  return (
    set.observations.length > 0 ||
    set.labReports.length > 0 ||
    set.labValues.length > 0 ||
    set.supplements.length > 0 ||
    set.openPoints.length > 0 ||
    set.profileVersions.length > 0 ||
    set.timelineEntries.length > 0
  );
}

/**
 * Wrap a parsed entity into a full domain shape with a placeholder
 * id and bookkeeping fields. The matcher's `SKIP_FIELDS` set
 * ignores those bookkeeping fields when computing diffs, so the
 * placeholder values do not contribute to conflict detection.
 */
function wrapForMatch<
  T extends { id: string; profileId: string; createdAt: number; updatedAt: number },
>(parsed: Omit<T, 'id' | 'profileId' | 'createdAt' | 'updatedAt'>, profileId: string): T {
  return {
    ...parsed,
    id: 'detect-placeholder',
    profileId,
    createdAt: 0,
    updatedAt: 0,
  } as T;
}

/**
 * Dry-run matcher: load existing rows + build conflict-only
 * filtered match list per entity type for which the mode map
 * is `'merge'`. Types not in merge mode get an empty conflict
 * list (their resolution path is replace / add / skip and does
 * not need user decisions).
 */
export async function detectMergeConflicts(
  parseResult: ParseResult,
  targetProfileId: string,
  modeMap: ResolvedModeMap,
): Promise<MergeConflictSet> {
  const set: MergeConflictSet = {
    observations: [],
    labReports: [],
    labValues: [],
    supplements: [],
    openPoints: [],
    profileVersions: [],
    timelineEntries: [],
  };

  if (modeMap.observations === 'merge') {
    const existing = await new ObservationRepository().listByProfile(targetProfileId);
    const parsed: Observation[] = parseResult.observations.map((p) =>
      wrapForMatch<Observation>(p, targetProfileId),
    );
    const matches = matchObservations(existing, parsed);
    set.observations = matches.filter(
      (m): m is Extract<MergeMatch<'observations'>, { outcome: 'conflict' }> =>
        m.outcome === 'conflict',
    );
  }

  if (modeMap.supplements === 'merge') {
    const existing = await new SupplementRepository().listByProfile(targetProfileId);
    const parsed: Supplement[] = parseResult.supplements.map((p) =>
      wrapForMatch<Supplement>(p, targetProfileId),
    );
    const matches = matchSupplements(existing, parsed);
    set.supplements = matches.filter(
      (m): m is Extract<MergeMatch<'supplements'>, { outcome: 'conflict' }> =>
        m.outcome === 'conflict',
    );
  }

  if (modeMap.openPoints === 'merge') {
    const existing = await new OpenPointRepository().listByProfile(targetProfileId);
    const parsed: OpenPoint[] = parseResult.openPoints.map((p) =>
      wrapForMatch<OpenPoint>(p, targetProfileId),
    );
    const matches = matchOpenPoints(existing, parsed);
    set.openPoints = matches.filter(
      (m): m is Extract<MergeMatch<'openPoints'>, { outcome: 'conflict' }> =>
        m.outcome === 'conflict',
    );
  }

  if (modeMap.profileVersions === 'merge') {
    const existing = await new ProfileVersionRepository().listByProfile(targetProfileId);
    const parsed: ProfileVersion[] = parseResult.profileVersions.map((p) =>
      wrapForMatch<ProfileVersion>(p, targetProfileId),
    );
    const matches = matchProfileVersions(existing, parsed);
    set.profileVersions = matches.filter(
      (m): m is Extract<MergeMatch<'profileVersions'>, { outcome: 'conflict' }> =>
        m.outcome === 'conflict',
    );
  }

  if (modeMap.timelineEntries === 'merge') {
    const existing = await new TimelineEntryRepository().listByProfile(targetProfileId);
    const parsed: TimelineEntry[] = parseResult.timelineEntries.map((p) =>
      wrapForMatch<TimelineEntry>(p, targetProfileId),
    );
    const matches = matchTimelineEntries(existing, parsed);
    set.timelineEntries = matches.filter(
      (m): m is Extract<MergeMatch<'timelineEntries'>, { outcome: 'conflict' }> =>
        m.outcome === 'conflict',
    );
  }

  if (modeMap.labData === 'merge') {
    // Reports first; values follow per-parent (W6 scoping).
    const labValueRepo = new LabValueRepository();
    const labReportRepo = new LabReportRepository(labValueRepo);
    const existingReports: LabReport[] = await labReportRepo.listByProfile(targetProfileId);
    const existingValues: LabValue[] = await labValueRepo.listByProfile(targetProfileId);

    const parsedReports: LabReport[] = parseResult.labReports.map((p) =>
      wrapForMatch<LabReport>(p, targetProfileId),
    );
    const reportMatches = matchLabReports(existingReports, parsedReports);
    set.labReports = reportMatches.filter(
      (m): m is Extract<MergeMatch<'labReports'>, { outcome: 'conflict' }> =>
        m.outcome === 'conflict',
    );

    // Lab values: bind to the matched parent's id when available, else
    // a sentinel ('detect-placeholder') so the per-parent matcher can
    // route them to the empty bucket. We do not need a real id since
    // the matcher only uses the parent-match outcome to decide whether
    // existing values exist.
    const existingValuesByReportId = new Map<string, LabValue[]>();
    for (const v of existingValues) {
      const arr = existingValuesByReportId.get(v.reportId) ?? [];
      arr.push(v);
      existingValuesByReportId.set(v.reportId, arr);
    }
    const parsedValuesWithIndex = parseResult.labValues.map((parsed) => {
      const m = reportMatches[parsed.reportIndex];
      const reportId = m && m.outcome !== 'new' ? m.existing.id : 'detect-placeholder';
      const entity = wrapForMatch<LabValue>(
        {
          category: parsed.category,
          parameter: parsed.parameter,
          result: parsed.result,
          unit: parsed.unit,
          referenceRange: parsed.referenceRange,
          assessment: parsed.assessment,
          reportId,
        },
        targetProfileId,
      );
      return Object.assign(entity, { reportIndex: parsed.reportIndex });
    });
    const valueMatches = matchLabValuesPerReport(
      reportMatches,
      parsedValuesWithIndex,
      existingValuesByReportId,
    );
    set.labValues = valueMatches.filter(
      (m): m is Extract<MergeMatch<'labValues'>, { outcome: 'conflict' }> =>
        m.outcome === 'conflict',
    );
  }

  return set;
}
