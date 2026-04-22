import { describe, it, expect } from 'vitest';
import { parseGermanDate, extractNumber } from './parseGermanDate';

describe('parseGermanDate', () => {
  it('parses DD.MM.YYYY', () => {
    expect(parseGermanDate('28.08.1969')).toBe('1969-08-28');
  });

  it('parses single-digit day and month', () => {
    expect(parseGermanDate('5.3.2024')).toBe('2024-03-05');
  });

  it('parses German month name + year for all 12 months', () => {
    expect(parseGermanDate('Januar 2025')).toBe('2025-01-01');
    expect(parseGermanDate('Februar 2025')).toBe('2025-02-01');
    expect(parseGermanDate('Maerz 2025')).toBe('2025-03-01');
    expect(parseGermanDate('April 2025')).toBe('2025-04-01');
    expect(parseGermanDate('Mai 2025')).toBe('2025-05-01');
    expect(parseGermanDate('Juni 2025')).toBe('2025-06-01');
    expect(parseGermanDate('Juli 2025')).toBe('2025-07-01');
    expect(parseGermanDate('August 2025')).toBe('2025-08-01');
    expect(parseGermanDate('September 2025')).toBe('2025-09-01');
    expect(parseGermanDate('Oktober 2025')).toBe('2025-10-01');
    expect(parseGermanDate('November 2025')).toBe('2025-11-01');
    expect(parseGermanDate('Dezember 2025')).toBe('2025-12-01');
  });

  it('is case-insensitive for month names', () => {
    expect(parseGermanDate('dezember 2024')).toBe('2024-12-01');
    expect(parseGermanDate('MAERZ 2026')).toBe('2026-03-01');
  });

  it('accepts the Unicode `März` form alongside the transliteration [TD-09 a]', () => {
    expect(parseGermanDate('März 2026')).toBe('2026-03-01');
    expect(parseGermanDate('märz 2026')).toBe('2026-03-01');
    expect(parseGermanDate('MÄRZ 2026')).toBe('2026-03-01');
  });

  it('returns null for two-digit year', () => {
    expect(parseGermanDate('28.08.69')).toBeNull();
  });

  it('returns null for unrecognized format', () => {
    expect(parseGermanDate('garbage')).toBeNull();
    expect(parseGermanDate('')).toBeNull();
    expect(parseGermanDate('2024-12-15')).toBeNull(); // ISO not recognized (intentional)
  });

  it('trims whitespace', () => {
    expect(parseGermanDate('  28.08.1969  ')).toBe('1969-08-28');
  });
});

describe('extractNumber', () => {
  it('extracts integer', () => {
    expect(extractNumber('56 Jahre')).toBe(56);
  });

  it('extracts decimal with period', () => {
    expect(extractNumber('92.5 kg')).toBe(92.5);
  });

  it('extracts decimal with comma (German)', () => {
    expect(extractNumber('92,5 kg')).toBe(92.5);
  });

  it('extracts first number from complex text', () => {
    expect(extractNumber('ca. 82 kg (BMI 24,5)')).toBe(82);
  });

  it('returns null for no number', () => {
    expect(extractNumber('no numbers here')).toBeNull();
  });
});
