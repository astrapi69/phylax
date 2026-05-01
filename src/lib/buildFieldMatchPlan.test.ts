import { describe, it, expect } from 'vitest';
import { buildFieldMatchPlan } from './buildFieldMatchPlan';

describe('buildFieldMatchPlan', () => {
  it('returns empty plan + zero total for empty query', () => {
    const fields = [{ key: 'a', text: 'hello' }];
    const result = buildFieldMatchPlan(fields, '');
    expect(result.totalMatches).toBe(0);
    expect(result.matchPlan.size).toBe(0);
  });

  it('returns empty plan + zero total for whitespace-only query', () => {
    const fields = [{ key: 'a', text: 'hello' }];
    const result = buildFieldMatchPlan(fields, '   ');
    expect(result.totalMatches).toBe(0);
    expect(result.matchPlan.size).toBe(0);
  });

  it('returns empty plan when no fields match', () => {
    const fields = [
      { key: 'a', text: 'hello' },
      { key: 'b', text: 'world' },
    ];
    const result = buildFieldMatchPlan(fields, 'xyz');
    expect(result.totalMatches).toBe(0);
    expect(result.matchPlan.size).toBe(0);
  });

  it('omits fields with zero matches from the plan', () => {
    const fields = [
      { key: 'a', text: 'foo bar' },
      { key: 'b', text: 'baz' },
      { key: 'c', text: 'foo qux' },
    ];
    const result = buildFieldMatchPlan(fields, 'foo');
    expect(result.matchPlan.has('b')).toBe(false);
    expect(result.matchPlan.has('a')).toBe(true);
    expect(result.matchPlan.has('c')).toBe(true);
  });

  it('assigns sequential startIndex in field display order', () => {
    const fields = [
      { key: 'first', text: 'foo' },
      { key: 'second', text: 'foo foo' },
      { key: 'third', text: 'foo' },
    ];
    const result = buildFieldMatchPlan(fields, 'foo');
    expect(result.matchPlan.get('first')?.startIndex).toBe(1);
    expect(result.matchPlan.get('second')?.startIndex).toBe(2);
    expect(result.matchPlan.get('third')?.startIndex).toBe(4);
    expect(result.totalMatches).toBe(4);
  });

  it('counts every range, not every field', () => {
    const fields = [{ key: 'a', text: 'foo foo foo' }];
    const result = buildFieldMatchPlan(fields, 'foo');
    expect(result.totalMatches).toBe(3);
    expect(result.matchPlan.get('a')?.ranges.length).toBe(3);
  });

  it('handles multi-term AND-like accumulation across fields', () => {
    const fields = [
      { key: 'a', text: 'foo' },
      { key: 'b', text: 'bar' },
    ];
    const result = buildFieldMatchPlan(fields, 'foo bar');
    expect(result.totalMatches).toBe(2);
    expect(result.matchPlan.get('a')?.ranges.length).toBe(1);
    expect(result.matchPlan.get('b')?.ranges.length).toBe(1);
  });

  it('is case- and diacritics-insensitive (delegated to splitQuery + findMatchRanges)', () => {
    const fields = [{ key: 'a', text: 'Müller' }];
    const result = buildFieldMatchPlan(fields, 'MULLER');
    expect(result.totalMatches).toBe(1);
    expect(result.matchPlan.get('a')?.ranges.length).toBe(1);
  });

  it('preserves caller-supplied keys including colons used by view layers', () => {
    const fields = [
      { key: 'theme:knee', text: 'knee pain' },
      { key: 'obs-1:fact', text: 'pain in knee' },
    ];
    const result = buildFieldMatchPlan(fields, 'pain');
    expect(result.matchPlan.has('theme:knee')).toBe(true);
    expect(result.matchPlan.has('obs-1:fact')).toBe(true);
  });

  it('returns ranges sorted within each field', () => {
    const fields = [{ key: 'a', text: 'foo bar foo' }];
    const result = buildFieldMatchPlan(fields, 'foo');
    const ranges = result.matchPlan.get('a')?.ranges ?? [];
    expect(ranges).toHaveLength(2);
    const [first, second] = ranges;
    if (!first || !second) throw new Error('expected two ranges');
    expect(first.start).toBeLessThan(second.start);
  });

  it('handles empty fields array', () => {
    const result = buildFieldMatchPlan([], 'foo');
    expect(result.totalMatches).toBe(0);
    expect(result.matchPlan.size).toBe(0);
  });
});
