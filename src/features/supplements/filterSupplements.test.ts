import { describe, it, expect } from 'vitest';
import type { Supplement, SupplementCategory } from '../../domain';
import { filterSupplements, type LabeledSupplementGroup } from './filterSupplements';

function makeSupplement(over: Partial<Supplement> = {}): Supplement {
  return {
    id: 's1',
    profileId: 'p1',
    createdAt: 0,
    updatedAt: 0,
    name: 'Vitamin D3',
    category: 'daily',
    ...over,
  };
}

function group(
  category: SupplementCategory,
  label: string,
  supplements: Supplement[],
): LabeledSupplementGroup {
  return { category, label, supplements };
}

describe('filterSupplements', () => {
  it('passes through unchanged when no query is active', () => {
    const groups = [group('daily', 'Täglich', [makeSupplement()])];
    const result = filterSupplements(groups);
    expect(result.groups).toBe(groups);
    expect(result.matchCount).toBe(1);
    expect(result.totalCount).toBe(1);
  });

  it('keeps a group when the translated label matches', () => {
    const groups = [
      group('daily', 'Täglich', [makeSupplement({ name: 'Magnesium' })]),
      group('paused', 'Pausiert', [makeSupplement({ id: 's2', name: 'Zink' })]),
    ];
    const result = filterSupplements(groups, { query: 'täglich' });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.category).toBe('daily');
  });

  it('keeps a group with ALL its supplements when any single supplement matches', () => {
    const groups = [
      group('daily', 'Täglich', [
        makeSupplement({ id: 's1', name: 'Magnesium' }),
        makeSupplement({ id: 's2', name: 'Vitamin D3' }),
        makeSupplement({ id: 's3', name: 'Omega 3' }),
      ]),
    ];
    const result = filterSupplements(groups, { query: 'magnesium' });
    expect(result.groups).toHaveLength(1);
    const first = result.groups[0];
    if (!first) throw new Error('expected one group');
    expect(first.supplements).toHaveLength(3);
    expect(first.supplements.map((s) => s.name).sort()).toEqual([
      'Magnesium',
      'Omega 3',
      'Vitamin D3',
    ]);
  });

  it('hides groups with no match anywhere', () => {
    const groups = [
      group('daily', 'Täglich', [makeSupplement({ name: 'Magnesium' })]),
      group('paused', 'Pausiert', [makeSupplement({ id: 's2', name: 'Zink' })]),
    ];
    const result = filterSupplements(groups, { query: 'omega' });
    expect(result.groups).toHaveLength(0);
    expect(result.matchCount).toBe(0);
    expect(result.totalCount).toBe(2);
  });

  it('matches multi-term queries across label + supplement haystack (AND)', () => {
    const groups = [
      group('daily', 'Täglich', [makeSupplement({ name: 'Magnesium', brand: 'tetesept' })]),
      group('paused', 'Pausiert', [
        makeSupplement({ id: 's2', name: 'Magnesium', brand: 'Other' }),
      ]),
    ];
    const result = filterSupplements(groups, { query: 'magnesium tetesept' });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.category).toBe('daily');
  });

  it('matches against brand / recommendation / rationale fields', () => {
    const groups = [
      group('daily', 'Täglich', [
        makeSupplement({
          name: 'Magnesium',
          brand: 'tetesept',
          recommendation: 'Morgens mit Frühstück',
          rationale: 'Empfohlen nach Bluttest',
        }),
      ]),
    ];
    expect(filterSupplements(groups, { query: 'tetesept' }).groups).toHaveLength(1);
    expect(filterSupplements(groups, { query: 'frühstück' }).groups).toHaveLength(1);
    expect(filterSupplements(groups, { query: 'bluttest' }).groups).toHaveLength(1);
  });

  it('honours German collation via normalizeForSearch (case + diacritics)', () => {
    const groups = [
      group('daily', 'Täglich', [makeSupplement({ name: 'Magnesium für Sportler' })]),
    ];
    const result = filterSupplements(groups, { query: 'FUR SPORTLER' });
    expect(result.groups).toHaveLength(1);
  });
});
