import { describe, it, expect } from 'vitest';
import {
  isDateRangeActive,
  isInDateRangeEpoch,
  isInDateRangeIso,
  parseDateBound,
  parseDateRange,
} from './dateRangeFilter';

describe('parseDateBound', () => {
  it('returns undefined for null and undefined', () => {
    expect(parseDateBound(null)).toBeUndefined();
    expect(parseDateBound(undefined)).toBeUndefined();
  });

  it('returns undefined for empty / whitespace string', () => {
    expect(parseDateBound('')).toBeUndefined();
    expect(parseDateBound('   ')).toBeUndefined();
  });

  it('returns the trimmed value for a valid ISO date', () => {
    expect(parseDateBound('2024-01-15')).toBe('2024-01-15');
    expect(parseDateBound('  2024-01-15  ')).toBe('2024-01-15');
  });

  it('rejects malformed inputs', () => {
    expect(parseDateBound('2024/01/15')).toBeUndefined();
    expect(parseDateBound('15.01.2024')).toBeUndefined();
    expect(parseDateBound('2024-1-1')).toBeUndefined();
    expect(parseDateBound('not-a-date')).toBeUndefined();
  });

  it('rejects invalid calendar dates', () => {
    expect(parseDateBound('2024-02-30')).toBeUndefined();
    expect(parseDateBound('2024-13-01')).toBeUndefined();
    expect(parseDateBound('2023-02-29')).toBeUndefined();
  });

  it('accepts a leap-year February 29', () => {
    expect(parseDateBound('2024-02-29')).toBe('2024-02-29');
  });
});

describe('parseDateRange', () => {
  it('reads from and to from URLSearchParams', () => {
    const params = new URLSearchParams({ from: '2024-01-01', to: '2024-12-31' });
    expect(parseDateRange(params)).toEqual({ from: '2024-01-01', to: '2024-12-31' });
  });

  it('omits invalid bounds without crashing', () => {
    const params = new URLSearchParams({ from: 'invalid', to: '2024-12-31' });
    expect(parseDateRange(params)).toEqual({ to: '2024-12-31' });
  });

  it('returns empty object when neither param is set', () => {
    expect(parseDateRange(new URLSearchParams())).toEqual({});
  });
});

describe('isInDateRangeEpoch', () => {
  // 2024-06-15 12:00 UTC = 1718452800000
  const NOON = Date.parse('2024-06-15T12:00:00.000Z');

  it('always returns true when range is empty', () => {
    expect(isInDateRangeEpoch(NOON, {})).toBe(true);
  });

  it('respects the lower bound (inclusive at start of day)', () => {
    expect(isInDateRangeEpoch(NOON, { from: '2024-06-15' })).toBe(true);
    expect(isInDateRangeEpoch(NOON, { from: '2024-06-16' })).toBe(false);
  });

  it('respects the upper bound (inclusive at end of day)', () => {
    expect(isInDateRangeEpoch(NOON, { to: '2024-06-15' })).toBe(true);
    expect(isInDateRangeEpoch(NOON, { to: '2024-06-14' })).toBe(false);
  });

  it('respects both bounds together', () => {
    const range = { from: '2024-06-01', to: '2024-06-30' };
    expect(isInDateRangeEpoch(NOON, range)).toBe(true);
    expect(isInDateRangeEpoch(Date.parse('2024-05-31T23:59:59Z'), range)).toBe(false);
    expect(isInDateRangeEpoch(Date.parse('2024-07-01T00:00:00Z'), range)).toBe(false);
  });

  it('captures any time within the bound day', () => {
    // 23:00 UTC on the from-day is included.
    const lateInFromDay = Date.parse('2024-06-15T23:00:00.000Z');
    expect(isInDateRangeEpoch(lateInFromDay, { from: '2024-06-15' })).toBe(true);
    // 00:01 UTC on the to-day is included.
    const earlyInToDay = Date.parse('2024-06-30T00:01:00.000Z');
    expect(isInDateRangeEpoch(earlyInToDay, { to: '2024-06-30' })).toBe(true);
  });

  it('returns no matches when from > to', () => {
    expect(isInDateRangeEpoch(NOON, { from: '2024-12-31', to: '2024-01-01' })).toBe(false);
  });
});

describe('isInDateRangeIso', () => {
  it('always returns true when range is empty', () => {
    expect(isInDateRangeIso('2024-06-15', {})).toBe(true);
  });

  it('respects the lower bound (inclusive)', () => {
    expect(isInDateRangeIso('2024-06-15', { from: '2024-06-15' })).toBe(true);
    expect(isInDateRangeIso('2024-06-14', { from: '2024-06-15' })).toBe(false);
  });

  it('respects the upper bound (inclusive)', () => {
    expect(isInDateRangeIso('2024-06-15', { to: '2024-06-15' })).toBe(true);
    expect(isInDateRangeIso('2024-06-16', { to: '2024-06-15' })).toBe(false);
  });

  it('respects both bounds together', () => {
    const range = { from: '2024-06-01', to: '2024-06-30' };
    expect(isInDateRangeIso('2024-06-15', range)).toBe(true);
    expect(isInDateRangeIso('2024-05-31', range)).toBe(false);
    expect(isInDateRangeIso('2024-07-01', range)).toBe(false);
  });

  it('returns no matches when from > to', () => {
    expect(isInDateRangeIso('2024-06-15', { from: '2024-12-31', to: '2024-01-01' })).toBe(false);
  });
});

describe('isDateRangeActive', () => {
  it('is false when both bounds are absent', () => {
    expect(isDateRangeActive({})).toBe(false);
    expect(isDateRangeActive({ from: undefined, to: undefined })).toBe(false);
  });

  it('is true when only from is set', () => {
    expect(isDateRangeActive({ from: '2024-01-01' })).toBe(true);
  });

  it('is true when only to is set', () => {
    expect(isDateRangeActive({ to: '2024-12-31' })).toBe(true);
  });

  it('is true when both are set', () => {
    expect(isDateRangeActive({ from: '2024-01-01', to: '2024-12-31' })).toBe(true);
  });
});
