import { describe, it, expect } from 'vitest';
import { parseVersionshistorie } from './parseVersionshistorie';

describe('parseVersionshistorie', () => {
  it('parses a version history table', () => {
    const md = [
      '| Version | Datum | Aenderung |',
      '|---------|-------|-----------|',
      '| 1.0 | Dezember 2024 | Erstversion |',
      '| 1.1 | 15.01.2025 | Blutbild ergaenzt |',
      '| 1.3.1 | Maerz 2026 | Abnehmplan hinzugefuegt |',
    ].join('\n');

    const result = parseVersionshistorie(md);
    expect(result).toHaveLength(3);
    expect(result[0]?.version).toBe('1.0');
    expect(result[0]?.changeDate).toBe('2024-12-01');
    expect(result[0]?.changeDescription).toBe('Erstversion');
    expect(result[1]?.changeDate).toBe('2025-01-15');
    expect(result[2]?.version).toBe('1.3.1');
    expect(result[2]?.changeDate).toBe('2026-03-01');
  });

  it('handles unparseable dates by keeping raw text', () => {
    const md = [
      '| Version | Datum | Aenderung |',
      '|---------|-------|-----------|',
      '| 1.0 | Q1 2024 | Initial |',
    ].join('\n');

    const result = parseVersionshistorie(md);
    expect(result[0]?.changeDate).toBe('Q1 2024');
  });

  it('handles empty table', () => {
    expect(parseVersionshistorie('')).toEqual([]);
  });

  it('skips rows without version and description', () => {
    const md = [
      '| Version | Datum | Aenderung |',
      '|---------|-------|-----------|',
      '| | | |',
    ].join('\n');

    expect(parseVersionshistorie(md)).toEqual([]);
  });

  it('defaults to "unknown" version when missing', () => {
    const md = [
      '| Version | Datum | Aenderung |',
      '|---------|-------|-----------|',
      '| | Dezember 2024 | Some change |',
    ].join('\n');

    const result = parseVersionshistorie(md);
    expect(result[0]?.version).toBe('unknown');
  });
});
