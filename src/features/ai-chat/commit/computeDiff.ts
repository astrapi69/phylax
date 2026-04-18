import type { Observation, Supplement } from '../../../domain';
import type {
  ParseResult,
  ParsedObservation,
  ParsedSupplement,
  ParsedOpenPoint,
} from '../../profile-import/parser/types';

/**
 * Result of matching an AI-produced parse result against the current
 * profile. The three-bucket shape (new / changed / unchanged) lets the
 * preview modal render each item distinctly and lets the commit step
 * know exactly which rows to create vs. update.
 *
 * Observations and supplements merge field-by-field: an empty field in
 * the incoming parse keeps the existing value. Open points are always
 * new - their text is free-form and deduping would be fragile.
 */
export interface ProfileDiff {
  observations: {
    new: ParsedObservation[];
    changed: ObservationChange[];
    unchanged: Observation[];
  };
  supplements: {
    new: ParsedSupplement[];
    changed: SupplementChange[];
    unchanged: Supplement[];
  };
  openPoints: {
    new: ParsedOpenPoint[];
  };
  /** Non-fatal diff-time issues (e.g., multiple theme matches). */
  warnings: DiffWarning[];
}

export interface ObservationChange {
  existing: Observation;
  incoming: ParsedObservation;
  /** Field-level merge result that will be written on commit. */
  merged: Observation;
  /** Fields whose merged value differs from the existing value. */
  fieldsChanged: Array<'status' | 'fact' | 'pattern' | 'selfRegulation'>;
}

export interface SupplementChange {
  existing: Supplement;
  incoming: ParsedSupplement;
  merged: Supplement;
  fieldsChanged: Array<'category' | 'brand' | 'recommendation' | 'rationale'>;
}

export type DiffWarning =
  | { kind: 'multi-match-observation'; theme: string; message: string }
  | { kind: 'multi-match-supplement'; name: string; message: string };

export interface CurrentProfileData {
  observations: Observation[];
  supplements: Supplement[];
}

/**
 * Seven days in milliseconds. Two observations with the same theme both
 * updated within this window trigger a multi-match warning so the user
 * can confirm the most-recent match is the intended target.
 */
const RECENT_MATCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const OBSERVATION_MERGE_FIELDS = ['status', 'fact', 'pattern', 'selfRegulation'] as const;
const SUPPLEMENT_MERGE_FIELDS = ['category', 'brand', 'recommendation', 'rationale'] as const;

export function computeDiff(parseResult: ParseResult, current: CurrentProfileData): ProfileDiff {
  const warnings: DiffWarning[] = [];

  const observations = diffObservations(parseResult.observations, current.observations, warnings);
  const supplements = diffSupplements(parseResult.supplements, current.supplements, warnings);

  return {
    observations,
    supplements,
    openPoints: { new: [...parseResult.openPoints] },
    warnings,
  };
}

function diffObservations(
  incoming: ParsedObservation[],
  current: Observation[],
  warnings: DiffWarning[],
): ProfileDiff['observations'] {
  const result: ProfileDiff['observations'] = { new: [], changed: [], unchanged: [] };
  const matchedIds = new Set<string>();
  const now = Date.now();

  for (const inc of incoming) {
    const key = normalizeKey(inc.theme);
    const candidates = current.filter((o) => normalizeKey(o.theme) === key);

    if (candidates.length === 0) {
      result.new.push(inc);
      continue;
    }

    if (candidates.length > 1) {
      const recentCount = candidates.filter(
        (o) => now - o.updatedAt <= RECENT_MATCH_WINDOW_MS,
      ).length;
      if (recentCount > 1) {
        warnings.push({
          kind: 'multi-match-observation',
          theme: inc.theme,
          message: `Mehrere Beobachtungen mit Thema "${inc.theme}" gefunden. Update wird auf die juengste angewendet.`,
        });
      }
    }

    const existing = [...candidates].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!existing) {
      result.new.push(inc);
      continue;
    }

    matchedIds.add(existing.id);
    const merged = mergeObservation(existing, inc);
    const fieldsChanged = diffObservationFields(existing, merged);
    if (fieldsChanged.length === 0) {
      result.unchanged.push(existing);
    } else {
      result.changed.push({ existing, incoming: inc, merged, fieldsChanged });
    }
  }

  return result;
}

function diffSupplements(
  incoming: ParsedSupplement[],
  current: Supplement[],
  warnings: DiffWarning[],
): ProfileDiff['supplements'] {
  const result: ProfileDiff['supplements'] = { new: [], changed: [], unchanged: [] };
  const now = Date.now();

  for (const inc of incoming) {
    const key = normalizeKey(inc.name);
    const candidates = current.filter((s) => normalizeKey(s.name) === key);

    if (candidates.length === 0) {
      result.new.push(inc);
      continue;
    }

    if (candidates.length > 1) {
      const recentCount = candidates.filter(
        (s) => now - s.updatedAt <= RECENT_MATCH_WINDOW_MS,
      ).length;
      if (recentCount > 1) {
        warnings.push({
          kind: 'multi-match-supplement',
          name: inc.name,
          message: `Mehrere Supplemente mit Name "${inc.name}" gefunden. Update wird auf das juengste angewendet.`,
        });
      }
    }

    const existing = [...candidates].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (!existing) {
      result.new.push(inc);
      continue;
    }

    const merged = mergeSupplement(existing, inc);
    const fieldsChanged = diffSupplementFields(existing, merged);
    if (fieldsChanged.length === 0) {
      result.unchanged.push(existing);
    } else {
      result.changed.push({ existing, incoming: inc, merged, fieldsChanged });
    }
  }

  return result;
}

function mergeObservation(existing: Observation, incoming: ParsedObservation): Observation {
  return {
    ...existing,
    status: pickNonEmpty(incoming.status, existing.status),
    fact: pickNonEmpty(incoming.fact, existing.fact),
    pattern: pickNonEmpty(incoming.pattern, existing.pattern),
    selfRegulation: pickNonEmpty(incoming.selfRegulation, existing.selfRegulation),
    // source, extraSections, medicalFinding, relevanceNotes preserved from existing
  };
}

function mergeSupplement(existing: Supplement, incoming: ParsedSupplement): Supplement {
  return {
    ...existing,
    category: incoming.category,
    brand: pickNonEmpty(incoming.brand, existing.brand),
    recommendation: pickNonEmpty(incoming.recommendation, existing.recommendation),
    rationale: pickNonEmpty(incoming.rationale, existing.rationale),
  };
}

function diffObservationFields(
  existing: Observation,
  merged: Observation,
): Array<'status' | 'fact' | 'pattern' | 'selfRegulation'> {
  const out: Array<'status' | 'fact' | 'pattern' | 'selfRegulation'> = [];
  for (const field of OBSERVATION_MERGE_FIELDS) {
    if (existing[field] !== merged[field]) out.push(field);
  }
  return out;
}

function diffSupplementFields(
  existing: Supplement,
  merged: Supplement,
): Array<'category' | 'brand' | 'recommendation' | 'rationale'> {
  const out: Array<'category' | 'brand' | 'recommendation' | 'rationale'> = [];
  for (const field of SUPPLEMENT_MERGE_FIELDS) {
    const existingValue = existing[field] ?? '';
    const mergedValue = merged[field] ?? '';
    if (existingValue !== mergedValue) out.push(field);
  }
  return out;
}

function pickNonEmpty<T extends string | undefined>(incoming: T, fallback: T): T {
  if (typeof incoming === 'string' && incoming.trim().length > 0) return incoming;
  return fallback;
}

function normalizeKey(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** Total number of additive or mutating items in the diff. */
export function diffItemCount(diff: ProfileDiff): number {
  return (
    diff.observations.new.length +
    diff.observations.changed.length +
    diff.supplements.new.length +
    diff.supplements.changed.length +
    diff.openPoints.new.length
  );
}
