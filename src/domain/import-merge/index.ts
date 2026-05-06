/**
 * IM-06 field-level merge: public barrel.
 *
 * Consumers (the import storage layer + the conflict-resolution
 * UI) import from this index rather than reaching into individual
 * files. Internal cross-references inside `import-merge/` continue
 * to use direct file paths.
 */

export type {
  MergeableEntityKey,
  MergeEntity,
  MergeEntityMap,
  MatchOutcome,
  FieldDiff,
  MergeMatch,
  MergeMatchSet,
  ConflictResolution,
  MergeResolutions,
} from './types';

export {
  observationKey,
  labReportKey,
  labValueKey,
  supplementKey,
  openPointKey,
  profileVersionKey,
  timelineEntryKey,
} from './naturalKey';

export {
  matchObservations,
  matchLabReports,
  matchLabValuesWithinReport,
  matchLabValuesPerReport,
  matchSupplements,
  matchOpenPoints,
  matchProfileVersions,
  matchTimelineEntries,
  countOutcomes,
} from './matchEntities';

export { resolveMerge, planCounts, UnresolvedConflictError } from './resolveMerge';

export type { EntityUpdate, MergePlan, ResolutionMap } from './resolveMerge';
