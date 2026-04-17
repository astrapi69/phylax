import type { Supplement, SupplementCategory } from '../../domain';

export function makeSupplement(overrides: Partial<Supplement> = {}): Supplement {
  return {
    id: 's1',
    profileId: 'p1',
    createdAt: 1,
    updatedAt: 1,
    name: 'Vitamin D3 2000 IE',
    category: 'daily' satisfies SupplementCategory,
    ...overrides,
  };
}
