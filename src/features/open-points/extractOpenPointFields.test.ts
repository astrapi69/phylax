import { describe, it, expect } from 'vitest';
import type { OpenPoint } from '../../domain';
import { extractOpenPointFields } from './extractOpenPointFields';
import type { ContextGroup } from './useOpenPoints';

function point(overrides: Partial<OpenPoint> & { id: string; text: string }): OpenPoint {
  return {
    profileId: 'p1',
    createdAt: 1,
    updatedAt: 1,
    context: 'Arztbesuch',
    resolved: false,
    ...overrides,
  };
}

function group(context: string, items: OpenPoint[]): ContextGroup {
  return { context, items };
}

describe('extractOpenPointFields', () => {
  it('returns empty for no groups', () => {
    expect(extractOpenPointFields([])).toEqual([]);
  });

  it('emits context label first then per item in render order', () => {
    const fields = extractOpenPointFields([
      group('Arztbesuch', [
        point({
          id: 'p1',
          text: 'Bluttest',
          priority: 'hoch',
          timeHorizon: '3 Monate',
          details: 'Eisenwerte',
        }),
      ]),
    ]);
    expect(fields.map((f) => f.key)).toEqual([
      'ctx:Arztbesuch:label',
      'op:p1:text',
      'op:p1:priority',
      'op:p1:timeHorizon',
      'op:p1:details',
    ]);
    expect(fields[0]?.text).toBe('Arztbesuch');
  });

  it('omits optional fields when undefined or whitespace-only', () => {
    const fields = extractOpenPointFields([
      group('Arztbesuch', [point({ id: 'p1', text: 'Bluttest', details: '   ' })]),
    ]);
    expect(fields.map((f) => f.key)).toEqual(['ctx:Arztbesuch:label', 'op:p1:text']);
  });

  it('preserves group iteration order across multiple groups', () => {
    const fields = extractOpenPointFields([
      group('A', [point({ id: 'p1', text: 'x' })]),
      group('B', [point({ id: 'p2', text: 'y', context: 'B' })]),
    ]);
    expect(fields.map((f) => f.key)).toEqual([
      'ctx:A:label',
      'op:p1:text',
      'ctx:B:label',
      'op:p2:text',
    ]);
  });

  it('preserves item iteration order within a group', () => {
    const fields = extractOpenPointFields([
      group('Arztbesuch', [
        point({ id: 'p1', text: 'A' }),
        point({ id: 'p2', text: 'B' }),
        point({ id: 'p3', text: 'C' }),
      ]),
    ]);
    expect(fields.map((f) => f.key)).toEqual([
      'ctx:Arztbesuch:label',
      'op:p1:text',
      'op:p2:text',
      'op:p3:text',
    ]);
  });
});
