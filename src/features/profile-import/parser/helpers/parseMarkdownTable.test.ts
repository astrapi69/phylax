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
      '| **Täglich** | Vitamin D |',
    ].join('\n');
    const rows = parseMarkdownTable(md);
    expect(rows[0]?.['Kategorie']).toBe('**Täglich**');
  });

  describe('escaped characters in cells (BUG-17)', () => {
    it('reads an escaped pipe as a literal pipe inside the cell', () => {
      const md = ['| Kategorie | Präparat |', '|---|---|', '| täglich | Zink \\| Kupfer |'].join(
        '\n',
      );
      const rows = parseMarkdownTable(md);
      expect(rows[0]?.['Kategorie']).toBe('täglich');
      expect(rows[0]?.['Präparat']).toBe('Zink | Kupfer');
    });

    it('reads a doubled backslash as one backslash', () => {
      const md = ['| A | B |', '|---|---|', '| x\\\\y | 2 |'].join('\n');
      const rows = parseMarkdownTable(md);
      expect(rows[0]?.['A']).toBe('x\\y');
      expect(rows[0]?.['B']).toBe('2');
    });

    it('ends the cell at a pipe that follows an escaped backslash', () => {
      // x\\|y is an escaped backslash, then a cell boundary.
      const md = ['| A | B |', '|---|---|', '| x\\\\|y |'].join('\n');
      const rows = parseMarkdownTable(md);
      expect(rows[0]?.['A']).toBe('x\\');
      expect(rows[0]?.['B']).toBe('y');
    });

    it('keeps a backslash before any other character', () => {
      const md = ['| A | B |', '|---|---|', '| C:\\Daten\\neu | \\* |'].join('\n');
      const rows = parseMarkdownTable(md);
      expect(rows[0]?.['A']).toBe('C:\\Daten\\neu');
      expect(rows[0]?.['B']).toBe('\\*');
    });

    it('keeps an escaped pipe at the end of the last cell', () => {
      const md = ['| A | B |', '|---|---|', '| 1 | a\\||'].join('\n');
      const rows = parseMarkdownTable(md);
      expect(rows[0]?.['A']).toBe('1');
      expect(rows[0]?.['B']).toBe('a|');
    });

    it('keeps a single backslash at the very end of a row', () => {
      const md = ['| A | B |', '|---|---|', '| 1 | a\\'].join('\n');
      const rows = parseMarkdownTable(md);
      expect(rows[0]?.['B']).toBe('a\\');
    });

    it('reads an escaped pipe in a header', () => {
      const md = ['| A\\|B | C |', '|---|---|', '| 1 | 2 |'].join('\n');
      const rows = parseMarkdownTable(md);
      expect(rows[0]?.['A|B']).toBe('1');
      expect(rows[0]?.['C']).toBe('2');
    });

    it('reads a row without framing pipes', () => {
      const md = ['| A | B |', '|---|---|', '| 1 | 2'].join('\n');
      const rows = parseMarkdownTable(md);
      expect(rows[0]?.['A']).toBe('1');
      expect(rows[0]?.['B']).toBe('2');
    });

    it('reads an empty cell between two pipes', () => {
      const md = ['| A | B | C |', '|---|---|---|', '| 1 || 3 |'].join('\n');
      const rows = parseMarkdownTable(md);
      expect(rows[0]?.['A']).toBe('1');
      expect(rows[0]?.['B']).toBe('');
      expect(rows[0]?.['C']).toBe('3');
    });
  });
});
