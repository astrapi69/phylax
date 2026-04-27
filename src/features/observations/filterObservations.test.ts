import { describe, it, expect } from 'vitest';
import type { Observation } from '../../domain';
import { filterObservations } from './filterObservations';
import { makeObservation } from './test-helpers';
import type { ThemeGroup } from './useObservations';

function group(theme: string, ...overrides: Partial<Observation>[]): ThemeGroup {
  return {
    theme,
    observations: overrides.map((o, i) => makeObservation({ id: `${theme}-${i}`, theme, ...o })),
  };
}

describe('filterObservations', () => {
  it('returns all groups when query is empty', () => {
    const groups = [group('Schulter', { fact: 'Schmerz' })];
    const result = filterObservations(groups, '');
    expect(result.groups).toEqual(groups);
    expect(result.matchCount).toBe(1);
    expect(result.totalCount).toBe(1);
  });

  it('returns all groups for whitespace-only query', () => {
    const groups = [group('Schulter', { fact: 'Schmerz' })];
    const result = filterObservations(groups, '   ');
    expect(result.groups).toEqual(groups);
    expect(result.matchCount).toBe(1);
  });

  it('matches against the theme field', () => {
    const groups = [
      group('Schulter', { fact: 'X' }),
      group('Knie', { fact: 'Y' }),
    ];
    const result = filterObservations(groups, 'knie');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.theme).toBe('Knie');
    expect(result.matchCount).toBe(1);
    expect(result.totalCount).toBe(2);
  });

  it('matches against the fact field', () => {
    const groups = [
      group('Schulter', { fact: 'Stechender Schmerz' }, { fact: 'Druck' }),
    ];
    const result = filterObservations(groups, 'stechend');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.observations).toHaveLength(1);
    expect(result.groups[0]?.observations[0]?.fact).toContain('Stechender');
    expect(result.matchCount).toBe(1);
  });

  it('matches against the pattern field', () => {
    const groups = [
      group('Schulter', { pattern: 'morgens schlechter' }, { pattern: 'abends besser' }),
    ];
    const result = filterObservations(groups, 'morgens');
    expect(result.groups[0]?.observations).toHaveLength(1);
    expect(result.matchCount).toBe(1);
  });

  it('does NOT match against selfRegulation, medicalFinding, or relevanceNotes', () => {
    const groups = [
      group('Schulter', {
        fact: 'X',
        pattern: 'Y',
        selfRegulation: 'Mobilisation',
        medicalFinding: 'Bursitis',
        relevanceNotes: 'siehe MRT',
      }),
    ];
    expect(filterObservations(groups, 'mobilisation').matchCount).toBe(0);
    expect(filterObservations(groups, 'bursitis').matchCount).toBe(0);
    expect(filterObservations(groups, 'mrt').matchCount).toBe(0);
  });

  it('is case-insensitive', () => {
    const groups = [group('Schulter', { fact: 'Stechender Schmerz' })];
    expect(filterObservations(groups, 'SCHMERZ').matchCount).toBe(1);
    expect(filterObservations(groups, 'schmerz').matchCount).toBe(1);
    expect(filterObservations(groups, 'ScHmErZ').matchCount).toBe(1);
  });

  it('is diacritics-insensitive', () => {
    const groups = [group('Müller', { fact: 'Über die Schulter' })];
    expect(filterObservations(groups, 'muller').matchCount).toBe(1);
    expect(filterObservations(groups, 'uber').matchCount).toBe(1);
  });

  it('does not transliterate ue to umlaut', () => {
    const groups = [group('Müller', { fact: 'X' })];
    expect(filterObservations(groups, 'mueller').matchCount).toBe(0);
  });

  it('treats whitespace-separated terms as AND', () => {
    const groups = [
      group(
        'Schulter',
        { fact: 'stechender schmerz', pattern: 'morgens schlechter' },
        { fact: 'dumpfer schmerz', pattern: 'abends besser' },
      ),
    ];
    const result = filterObservations(groups, 'schmerz morgens');
    expect(result.matchCount).toBe(1);
    expect(result.groups[0]?.observations[0]?.fact).toContain('stechender');
  });

  it('AND terms can match across different fields of the same observation', () => {
    const groups = [
      group('Schulter', { fact: 'stechender schmerz', pattern: 'morgens akut' }),
    ];
    const result = filterObservations(groups, 'schulter schmerz');
    expect(result.matchCount).toBe(1);
  });

  it('filters out groups with zero matches', () => {
    const groups = [
      group('Schulter', { fact: 'schmerz' }),
      group('Knie', { fact: 'kein treffer' }),
    ];
    const result = filterObservations(groups, 'schmerz');
    expect(result.groups).toHaveLength(1);
    expect(result.groups.map((g) => g.theme)).toEqual(['Schulter']);
  });

  it('returns matchCount 0 when nothing matches', () => {
    const groups = [group('Schulter', { fact: 'nichts' })];
    const result = filterObservations(groups, 'xyz');
    expect(result.groups).toHaveLength(0);
    expect(result.matchCount).toBe(0);
    expect(result.totalCount).toBe(1);
  });

  it('handles 100+ observations without breaking', () => {
    const observations: Partial<Observation>[] = Array.from({ length: 150 }, (_, i) => ({
      fact: i % 3 === 0 ? 'gesucht' : 'andere',
      pattern: `pattern ${i}`,
    }));
    const groups = [group('Theme', ...observations)];
    const result = filterObservations(groups, 'gesucht');
    expect(result.totalCount).toBe(150);
    expect(result.matchCount).toBe(50);
  });
});
