import { describe, it, expect } from 'vitest';
import type { Supplement } from '../../domain';
import { extractSupplementFields } from './extractSupplementFields';
import type { LabeledSupplementGroup } from './filterSupplements';

function sup(overrides: Partial<Supplement> & { id: string; name: string }): Supplement {
  return {
    profileId: 'p1',
    createdAt: 1,
    updatedAt: 1,
    category: 'daily',
    ...overrides,
  };
}

function group(
  category: LabeledSupplementGroup['category'],
  label: string,
  supplements: Supplement[],
): LabeledSupplementGroup {
  return { category, label, supplements };
}

describe('extractSupplementFields', () => {
  it('returns empty for no groups', () => {
    expect(extractSupplementFields([])).toEqual([]);
  });

  it('emits group label first then per supplement in card order', () => {
    const fields = extractSupplementFields([
      group('daily', 'Täglich', [
        sup({
          id: 's1',
          name: 'Vitamin D',
          brand: 'Acme',
          recommendation: '1000 IE',
          rationale: 'Mangel',
        }),
      ]),
    ]);
    expect(fields.map((f) => f.key)).toEqual([
      'cat:daily:label',
      'sup:s1:name',
      'sup:s1:brand',
      'sup:s1:recommendation',
      'sup:s1:rationale',
    ]);
    expect(fields[0]?.text).toBe('Täglich');
  });

  it('omits optional supplement fields when undefined', () => {
    const fields = extractSupplementFields([
      group('daily', 'Täglich', [sup({ id: 's1', name: 'Magnesium' })]),
    ]);
    expect(fields.map((f) => f.key)).toEqual(['cat:daily:label', 'sup:s1:name']);
  });

  it('preserves group iteration order across multiple groups', () => {
    const fields = extractSupplementFields([
      group('daily', 'Täglich', [sup({ id: 's1', name: 'A' })]),
      group('paused', 'Pausiert', [sup({ id: 's2', name: 'B', category: 'paused' })]),
    ]);
    expect(fields.map((f) => f.key)).toEqual([
      'cat:daily:label',
      'sup:s1:name',
      'cat:paused:label',
      'sup:s2:name',
    ]);
  });

  it('preserves supplement iteration order within a group', () => {
    const fields = extractSupplementFields([
      group('daily', 'Täglich', [
        sup({ id: 's1', name: 'A' }),
        sup({ id: 's2', name: 'B' }),
        sup({ id: 's3', name: 'C' }),
      ]),
    ]);
    expect(fields.map((f) => f.key)).toEqual([
      'cat:daily:label',
      'sup:s1:name',
      'sup:s2:name',
      'sup:s3:name',
    ]);
  });
});
