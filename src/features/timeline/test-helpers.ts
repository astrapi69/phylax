import type { Source, TimelineEntry } from '../../domain';

export function makeTimelineEntry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    id: 'te1',
    profileId: 'p1',
    createdAt: 1,
    updatedAt: 1,
    period: 'Maerz 2026',
    title: 'Gewichtszunahme und Abnehmplan',
    content: 'Narrative content **with emphasis**.',
    source: 'user' satisfies Source,
    ...overrides,
  };
}
