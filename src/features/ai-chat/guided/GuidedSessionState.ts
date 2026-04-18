import type { ProfileDiff } from '../commit';

export type GuidedSection = 'observations' | 'supplements' | 'open-points';

/**
 * Ephemeral state for an active guided session (AI-06).
 *
 * Not persisted: lives in useChat and resets on reload or clearChat. Progress
 * is tracked via committed sections - the session does not try to infer the
 * current section from the AI's conversation text.
 */
export interface GuidedSessionState {
  active: boolean;
  sectionsCompleted: readonly GuidedSection[];
  startedAt: number | null;
}

export function initGuidedSession(): GuidedSessionState {
  return { active: false, sectionsCompleted: [], startedAt: null };
}

export function startGuidedSession(now: number = Date.now()): GuidedSessionState {
  return { active: true, sectionsCompleted: [], startedAt: now };
}

export function endGuidedSession(): GuidedSessionState {
  return initGuidedSession();
}

/**
 * Mark a section as completed. Idempotent: completing the same section twice
 * leaves the list unchanged.
 */
export function markSectionCompleted(
  state: GuidedSessionState,
  section: GuidedSection,
): GuidedSessionState {
  if (state.sectionsCompleted.includes(section)) return state;
  return { ...state, sectionsCompleted: [...state.sectionsCompleted, section] };
}

/**
 * Inspect a commit diff and mark any section that received new or changed
 * content as completed. A mixed diff marks multiple sections in one call.
 * Unchanged items do not count.
 */
export function markSectionsFromDiff(
  state: GuidedSessionState,
  diff: ProfileDiff,
): GuidedSessionState {
  let next = state;
  if (diff.observations.new.length + diff.observations.changed.length > 0) {
    next = markSectionCompleted(next, 'observations');
  }
  if (diff.supplements.new.length + diff.supplements.changed.length > 0) {
    next = markSectionCompleted(next, 'supplements');
  }
  if (diff.openPoints.new.length > 0) {
    next = markSectionCompleted(next, 'open-points');
  }
  return next;
}

/** True once all three sections have been touched. */
export function isGuidedSessionComplete(state: GuidedSessionState): boolean {
  return (
    state.sectionsCompleted.includes('observations') &&
    state.sectionsCompleted.includes('supplements') &&
    state.sectionsCompleted.includes('open-points')
  );
}
