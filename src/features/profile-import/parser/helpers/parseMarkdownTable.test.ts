import { describe, it, expect } from 'vitest';
import { parseMarkdownTable } from './parseMarkdownTable';

describe('parseMarkdownTable', () => {
  it('parses a standard table', () => {
    const md = [
      '| Parameter | Ergebnis | Einheit |',
      '|-----------|----------|---------|',
      '| Leukozyten | 6,04 | G/l |',
      '| Erythrozyten | 4,83 | T/l |',
    ].join('\n');
    const rows = parseMarkdownTable(md);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.['Parameter']).toBe('Leukozyten');
    expect(rows[0]?.['Ergebnis']).toBe('6,04');
    expect(rows[1]?.['Einheit']).toBe('T/l');
  });

  it('handles missing columns in a row', () => {
    const md = ['| A | B | C |', '|---|---|---|', '| 1 | 2 |'].join('\n');
    const rows = parseMarkdownTable(md);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['A']).toBe('1');
    expect(rows[0]?.['B']).toBe('2');
    expect(rows[0]?.['C']).toBe('');
  });

  it('handles extra columns in a row', () => {
    const md = ['| A | B |', '|---|---|', '| 1 | 2 | 3 |'].join('\n');
    const rows = parseMarkdownTable(md);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.['A']).toBe('1');
    expect(rows[0]?.['B']).toBe('2');
  });

  it('returns empty for no table', () => {
    const rows = parseMarkdownTable('Just text, no table here.');
    expect(rows).toEqual([]);
  });

  it('returns empty for header-only table', () => {
    const md = '| A | B |\n|---|---|';
    const rows = parseMarkdownTable(md);
    expect(rows).toEqual([]);
  });

  it('trims whitespace from cells', () => {
    const md = ['|  Name  |  Value  |', '|--------|---------|', '|  foo   |  bar   |'].join('\n');
    const rows = parseMarkdownTable(md);
    expect(rows[0]?.['Name']).toBe('foo');
    expect(rows[0]?.['Value']).toBe('bar');
  });

  it('handles bold text in cells', () => {
    const md = [
      '| Kategorie | Praeparat |',
      '|-----------|-----------|',
      '| **Taeglich** | Vitamin D |',
    ].join('\n');
    const rows = parseMarkdownTable(md);
    expect(rows[0]?.['Kategorie']).toBe('**Taeglich**');
  });
});
