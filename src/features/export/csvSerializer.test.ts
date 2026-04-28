import { describe, it, expect } from 'vitest';
import { escapeCell, serializeCsv, serializeRow } from './csvSerializer';

describe('escapeCell', () => {
  it('returns empty string for undefined / null / empty', () => {
    expect(escapeCell(undefined, ',')).toBe('');
    expect(escapeCell(null, ',')).toBe('');
    expect(escapeCell('', ',')).toBe('');
  });

  it('returns plain value when no escape needed (comma separator)', () => {
    expect(escapeCell('TSH', ',')).toBe('TSH');
    expect(escapeCell('1.5', ',')).toBe('1.5');
  });

  it('quotes when value contains the configured comma separator', () => {
    expect(escapeCell('a, b', ',')).toBe('"a, b"');
    // Same value with semicolon separator does NOT need quoting.
    expect(escapeCell('a, b', ';')).toBe('a, b');
  });

  it('quotes when value contains the configured semicolon separator', () => {
    expect(escapeCell('a; b', ';')).toBe('"a; b"');
    expect(escapeCell('a; b', ',')).toBe('a; b');
  });

  it('escapes embedded double quotes by doubling and wraps', () => {
    expect(escapeCell('say "hi"', ',')).toBe('"say ""hi"""');
  });

  it('quotes values containing newlines', () => {
    expect(escapeCell('line1\nline2', ',')).toBe('"line1\nline2"');
    expect(escapeCell('line1\r\nline2', ',')).toBe('"line1\r\nline2"');
  });

  it('preserves diacritics and other unicode', () => {
    expect(escapeCell('Hämoglobin', ',')).toBe('Hämoglobin');
    expect(escapeCell('erhöht', ';')).toBe('erhöht');
  });
});

describe('serializeRow', () => {
  it('joins cells with separator and applies escaping', () => {
    expect(serializeRow(['a', 'b', 'c'], ',')).toBe('a,b,c');
    expect(serializeRow(['a', 'b', 'c'], ';')).toBe('a;b;c');
  });

  it('empty cells render as empty between separators', () => {
    expect(serializeRow(['a', undefined, 'c'], ',')).toBe('a,,c');
    expect(serializeRow(['a', '', 'c'], ',')).toBe('a,,c');
  });

  it('quotes cells containing the separator only', () => {
    expect(serializeRow(['plain', 'with, comma', 'plain'], ',')).toBe('plain,"with, comma",plain');
  });
});

describe('serializeCsv', () => {
  it('joins rows with CRLF', () => {
    const csv = serializeCsv(
      [
        ['a', 'b'],
        ['c', 'd'],
      ],
      ',',
    );
    expect(csv).toBe('a,b\r\nc,d');
  });

  it('handles empty input', () => {
    expect(serializeCsv([], ',')).toBe('');
  });

  it('handles header + rows + escapes together', () => {
    const csv = serializeCsv(
      [
        ['Datum', 'Parameter', 'Ergebnis'],
        ['2026-04-28', 'TSH', '1,5'],
        ['2026-04-28', 'Hämoglobin', '13,5'],
      ],
      ';',
    );
    expect(csv).toBe(
      'Datum;Parameter;Ergebnis\r\n2026-04-28;TSH;1,5\r\n2026-04-28;Hämoglobin;13,5',
    );
  });
});
