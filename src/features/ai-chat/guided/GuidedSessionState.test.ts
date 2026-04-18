import { describe, it, expect } from 'vitest';
import type { ProfileDiff } from '../commit';
import {
  endGuidedSession,
  initGuidedSession,
  isGuidedSessionComplete,
  markSectionCompleted,
  markSectionsFromDiff,
  startGuidedSession,
} from './GuidedSessionState';

function emptyDiff(): ProfileDiff {
  return {
    observations: { new: [], changed: [], unchanged: [] },
    supplements: { new: [], changed: [], unchanged: [] },
    openPoints: { new: [] },
    warnings: [],
  };
}

describe('GuidedSessionState', () => {
  it('initial state is inactive with no completed sections', () => {
    const state = initGuidedSession();
    expect(state.active).toBe(false);
    expect(state.sectionsCompleted).toEqual([]);
    expect(state.startedAt).toBeNull();
  });

  it('startGuidedSession activates and records startedAt', () => {
    const state = startGuidedSession(1700000000000);
    expect(state.active).toBe(true);
    expect(state.sectionsCompleted).toEqual([]);
    expect(state.startedAt).toBe(1700000000000);
  });

  it('endGuidedSession resets to the initial state', () => {
    const active = markSectionCompleted(startGuidedSession(1), 'observations');
    expect(active.active).toBe(true);
    const ended = endGuidedSession();
    expect(ended.active).toBe(false);
    expect(ended.sectionsCompleted).toEqual([]);
    expect(ended.startedAt).toBeNull();
  });

  it('markSectionsFromDiff marks observations when the diff has new observations', () => {
    const state = startGuidedSession(1);
    const diff = emptyDiff();
    diff.observations.new = [
      {
        theme: 'Knie',
        status: 'Akut',
        fact: 'Schmerzen',
        pattern: '',
        selfRegulation: '',
      } as unknown as ProfileDiff['observations']['new'][number],
    ];
    const next = markSectionsFromDiff(state, diff);
    expect(next.sectionsCompleted).toEqual(['observations']);
  });

  it('markSectionsFromDiff marks multiple sections on a mixed diff', () => {
    const state = startGuidedSession(1);
    const diff = emptyDiff();
    diff.observations.changed = [
      {
        existing: {},
        incoming: {},
        merged: {},
        fieldsChanged: ['fact'],
      } as unknown as ProfileDiff['observations']['changed'][number],
    ];
    diff.supplements.new = [
      {
        name: 'Magnesium',
        category: 'daily',
      } as unknown as ProfileDiff['supplements']['new'][number],
    ];
    diff.openPoints.new = [
      {
        context: 'Arzt',
        text: 'MRT besprechen',
      } as unknown as ProfileDiff['openPoints']['new'][number],
    ];
    const next = markSectionsFromDiff(state, diff);
    expect(next.sectionsCompleted).toEqual(['observations', 'supplements', 'open-points']);
    expect(isGuidedSessionComplete(next)).toBe(true);
  });

  it('markSectionsFromDiff ignores unchanged-only diffs', () => {
    const state = startGuidedSession(1);
    const diff = emptyDiff();
    diff.observations.unchanged = [
      { id: 'o1' } as unknown as ProfileDiff['observations']['unchanged'][number],
    ];
    diff.supplements.unchanged = [
      { id: 's1' } as unknown as ProfileDiff['supplements']['unchanged'][number],
    ];
    const next = markSectionsFromDiff(state, diff);
    expect(next.sectionsCompleted).toEqual([]);
    expect(next).toBe(state);
  });

  it('markSectionCompleted is idempotent for the same section', () => {
    let state = startGuidedSession(1);
    state = markSectionCompleted(state, 'observations');
    const second = markSectionCompleted(state, 'observations');
    expect(second).toBe(state);
    expect(second.sectionsCompleted).toEqual(['observations']);
  });
});
