import { describe, it, expect } from 'vitest';
import type { OpenPoint } from '../../domain';
import type { ContextGroup } from './useOpenPoints';
import { filterOpenPoints } from './filterOpenPoints';

function makeItem(over: Partial<OpenPoint> = {}): OpenPoint {
  return {
    id: 'op1',
    profileId: 'p1',
    createdAt: 0,
    updatedAt: 0,
    text: 'Bluttest beim Hausarzt',
    context: 'Arztbesuch',
    resolved: false,
    ...over,
  };
}

function group(context: string, items: OpenPoint[]): ContextGroup {
  return { context, items };
}

describe('filterOpenPoints', () => {
  it('passes through unchanged when no query is active', () => {
    const groups = [group('Arztbesuch', [makeItem()])];
    const result = filterOpenPoints(groups);
    expect(result.groups).toBe(groups);
    expect(result.matchCount).toBe(1);
    expect(result.totalCount).toBe(1);
  });

  it('keeps a group when the context label matches', () => {
    const groups = [
      group('Arztbesuch', [makeItem({ id: 'a1', text: 'Bluttest' })]),
      group('Laufende Beobachtung', [makeItem({ id: 'l1', text: 'Schlaf protokollieren' })]),
    ];
    const result = filterOpenPoints(groups, { query: 'arztbesuch' });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.context).toBe('Arztbesuch');
  });

  it('keeps a group with ALL items when any single item matches', () => {
    const groups = [
      group('Arztbesuch', [
        makeItem({ id: 'a1', text: 'Bluttest' }),
        makeItem({ id: 'a2', text: 'EKG abklären' }),
        makeItem({ id: 'a3', text: 'Allergiepass aktualisieren' }),
      ]),
    ];
    const result = filterOpenPoints(groups, { query: 'EKG' });
    expect(result.groups).toHaveLength(1);
    const first = result.groups[0];
    if (!first) throw new Error('expected one group');
    expect(first.items).toHaveLength(3);
    expect(first.items.map((i) => i.text).sort()).toEqual([
      'Allergiepass aktualisieren',
      'Bluttest',
      'EKG abklären',
    ]);
  });

  it('hides groups with no match anywhere', () => {
    const groups = [
      group('Arztbesuch', [makeItem({ text: 'Bluttest' })]),
      group('Laufende Beobachtung', [makeItem({ id: 'l1', text: 'Schlaf' })]),
    ];
    const result = filterOpenPoints(groups, { query: 'asdf' });
    expect(result.groups).toHaveLength(0);
    expect(result.matchCount).toBe(0);
    expect(result.totalCount).toBe(2);
  });

  it('matches multi-term queries across context + item haystack (AND)', () => {
    const groups = [
      group('Arztbesuch', [makeItem({ text: 'Bluttest beim Hausarzt' })]),
      group('Apotheke', [makeItem({ id: 'a1', text: 'Bluttest-Streifen kaufen' })]),
    ];
    const result = filterOpenPoints(groups, { query: 'arztbesuch hausarzt' });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.context).toBe('Arztbesuch');
  });

  it('matches against priority / timeHorizon / details fields', () => {
    const groups = [
      group('Arztbesuch', [
        makeItem({
          text: 'Bluttest',
          priority: 'hoch',
          timeHorizon: 'Innerhalb 3 Monate',
          details: 'Vollständiges Blutbild + Eisenwerte',
        }),
      ]),
    ];
    expect(filterOpenPoints(groups, { query: 'hoch' }).groups).toHaveLength(1);
    expect(filterOpenPoints(groups, { query: '3 Monate' }).groups).toHaveLength(1);
    expect(filterOpenPoints(groups, { query: 'eisenwerte' }).groups).toHaveLength(1);
  });

  it('honours German collation via normalizeForSearch (case + diacritics)', () => {
    const groups = [
      group('Ärztliche Abklärung', [makeItem({ text: 'Termin vereinbaren' })]),
    ];
    const result = filterOpenPoints(groups, { query: 'ARZTLICHE' });
    expect(result.groups).toHaveLength(1);
  });
});
