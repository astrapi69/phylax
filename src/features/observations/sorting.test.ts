import { describe, it, expect } from 'vitest';
import type { Observation } from '../../domain';
import type { ThemeGroup } from './useObservations';
import { sortObservations } from './sorting';

function obs(theme: string, updatedAt: number, id = `${theme}-${updatedAt}`): Observation {
  return {
    id,
    profileId: 'p1',
    createdAt: updatedAt,
    updatedAt,
    theme,
    fact: '',
    pattern: '',
    selfRegulation: '',
    status: '',
    source: 'user',
    extraSections: {},
  };
}

function group(theme: string, updatedAts: number[]): ThemeGroup {
  return {
    theme,
    observations: updatedAts.map((t, idx) => obs(theme, t, `${theme}-${idx}`)),
  };
}

const NOW = new Date('2026-04-30T12:00:00Z');
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const NOW_MS = NOW.getTime();

describe('sortObservations', () => {
  it('returns an empty array for empty input', () => {
    expect(sortObservations([], 'recent', NOW)).toEqual([]);
    expect(sortObservations([], 'alphabetical', NOW)).toEqual([]);
  });

  describe('recent mode', () => {
    it('puts groups with any observation in the last 30 days into the recent section', () => {
      const schulter = group('Schulter', [NOW_MS - 5 * ONE_DAY_MS]);
      const knie = group('Knie', [NOW_MS - 2 * ONE_DAY_MS]);
      const oldTheme = group('Oedem', [NOW_MS - 60 * ONE_DAY_MS]);

      const sections = sortObservations([schulter, knie, oldTheme], 'recent', NOW);
      expect(sections).toHaveLength(2);
      expect(sections[0]?.label).toBe('recent');
      expect(sections[0]?.themeGroups.map((g) => g.theme)).toEqual(['Knie', 'Schulter']);
      expect(sections[1]?.label).toBe('all');
      expect(sections[1]?.themeGroups.map((g) => g.theme)).toEqual(['Oedem']);
    });

    it('sorts the recent section by max(updatedAt) descending, tie-broken alphabetically', () => {
      const a = group('Aaa', [NOW_MS - 3 * ONE_DAY_MS]);
      const b = group('Bbb', [NOW_MS - 1 * ONE_DAY_MS]);
      const c = group('Ccc', [NOW_MS - 3 * ONE_DAY_MS]); // same as Aaa; ties break alphabetical
      const sections = sortObservations([a, b, c], 'recent', NOW);
      expect(sections[0]?.themeGroups.map((g) => g.theme)).toEqual(['Bbb', 'Aaa', 'Ccc']);
    });

    it('uses the newest observation within a group for recency ranking', () => {
      const schulter = group('Schulter', [
        NOW_MS - 40 * ONE_DAY_MS,
        NOW_MS - 10 * ONE_DAY_MS, // newest in group, within 30d
      ]);
      const knie = group('Knie', [NOW_MS - 25 * ONE_DAY_MS]);
      const oldTheme = group('Adern', [NOW_MS - 90 * ONE_DAY_MS]);
      const sections = sortObservations([schulter, knie, oldTheme], 'recent', NOW);
      expect(sections[0]?.label).toBe('recent');
      // Schulter's newest is -10d, Knie's is -25d; Schulter ranks above Knie
      expect(sections[0]?.themeGroups.map((g) => g.theme)).toEqual(['Schulter', 'Knie']);
    });

    it('omits the "recent" heading when nothing is recent (single section, no label)', () => {
      const oldA = group('Alt-A', [NOW_MS - 60 * ONE_DAY_MS]);
      const oldB = group('Alt-B', [NOW_MS - 90 * ONE_DAY_MS]);
      const sections = sortObservations([oldA, oldB], 'recent', NOW);
      expect(sections).toHaveLength(1);
      expect(sections[0]?.label).toBeNull();
      expect(sections[0]?.themeGroups.map((g) => g.theme)).toEqual(['Alt-A', 'Alt-B']);
    });

    it('omits the "all" heading when everything is recent (single section, no label)', () => {
      const a = group('Aaa', [NOW_MS - 3 * ONE_DAY_MS]);
      const b = group('Bbb', [NOW_MS - 5 * ONE_DAY_MS]);
      const sections = sortObservations([a, b], 'recent', NOW);
      expect(sections).toHaveLength(1);
      expect(sections[0]?.label).toBeNull();
      // Sorted by most-recent: Aaa (3d) before Bbb (5d)
      expect(sections[0]?.themeGroups.map((g) => g.theme)).toEqual(['Aaa', 'Bbb']);
    });

    it('treats exactly 30 days ago as recent (inclusive boundary)', () => {
      const onBoundary = group('Schulter', [NOW_MS - 30 * ONE_DAY_MS]);
      const sections = sortObservations([onBoundary], 'recent', NOW);
      expect(sections[0]?.themeGroups[0]?.theme).toBe('Schulter');
      // Single group ends up unlabeled (no "all" section to split from)
      expect(sections[0]?.label).toBeNull();
    });

    it('treats 30 days + 1 ms as not recent (exclusive past the boundary)', () => {
      const justOutside = group('Schulter', [NOW_MS - 30 * ONE_DAY_MS - 1]);
      const nothingRecent = group('Knie', [NOW_MS - 60 * ONE_DAY_MS]);
      const sections = sortObservations([justOutside, nothingRecent], 'recent', NOW);
      expect(sections).toHaveLength(1);
      expect(sections[0]?.label).toBeNull();
      // Neither is recent, both in all section alphabetical
      expect(sections[0]?.themeGroups.map((g) => g.theme)).toEqual(['Knie', 'Schulter']);
    });

    it('non-recent section sorts alphabetically with German locale (Umlaute)', () => {
      const sections = sortObservations(
        [
          group('Oedem', [NOW_MS - 60 * ONE_DAY_MS]),
          group('Adern', [NOW_MS - 90 * ONE_DAY_MS]),
          group('Uebergewicht', [NOW_MS - 45 * ONE_DAY_MS]),
        ],
        'recent',
        NOW,
      );
      expect(sections[0]?.themeGroups.map((g) => g.theme)).toEqual([
        'Adern',
        'Oedem',
        'Uebergewicht',
      ]);
    });
  });

  describe('alphabetical mode', () => {
    it('returns one unlabeled section with theme groups sorted via de collator', () => {
      const sections = sortObservations(
        [
          group('Schulter', [NOW_MS - 5 * ONE_DAY_MS]),
          group('Knie', [NOW_MS]),
          group('Adern', [NOW_MS - 60 * ONE_DAY_MS]),
        ],
        'alphabetical',
        NOW,
      );
      expect(sections).toHaveLength(1);
      expect(sections[0]?.label).toBeNull();
      expect(sections[0]?.themeGroups.map((g) => g.theme)).toEqual(['Adern', 'Knie', 'Schulter']);
    });

    it('ignores updatedAt in alphabetical mode even when some groups are recent', () => {
      const sections = sortObservations(
        [
          group('Zebra', [NOW_MS]), // very recent
          group('Adler', [NOW_MS - 365 * ONE_DAY_MS]), // very old
        ],
        'alphabetical',
        NOW,
      );
      // Adler before Zebra regardless of recency
      expect(sections[0]?.themeGroups.map((g) => g.theme)).toEqual(['Adler', 'Zebra']);
    });
  });
});
