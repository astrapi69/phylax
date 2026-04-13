import { describe, it, expect } from 'vitest';
import { parseWarnsignale, parseExterneReferenzen } from './parseWarnsignale';

describe('parseWarnsignale', () => {
  it('extracts bullet items', () => {
    const md = [
      '- Brustschmerzen bei Belastung',
      '- Ploetzlicher Schwindel',
      '- Anhaltende Atemnot',
    ].join('\n');

    const result = parseWarnsignale(md);
    expect(result).toEqual([
      'Brustschmerzen bei Belastung',
      'Ploetzlicher Schwindel',
      'Anhaltende Atemnot',
    ]);
  });

  it('handles asterisk bullets', () => {
    const md = '* Item A\n* Item B';
    expect(parseWarnsignale(md)).toEqual(['Item A', 'Item B']);
  });

  it('ignores non-bullet content', () => {
    const md = 'Some intro text.\n- Actual sign\nMore text.';
    expect(parseWarnsignale(md)).toEqual(['Actual sign']);
  });

  it('handles empty content', () => {
    expect(parseWarnsignale('')).toEqual([]);
  });

  it('trims whitespace', () => {
    expect(parseWarnsignale('-   padded item   ')).toEqual(['padded item']);
  });
});

describe('parseExterneReferenzen', () => {
  it('extracts bullet items', () => {
    const md = '- Lebende Gesundheit Serie: https://example.com\n- Arztbefund 2024';
    const result = parseExterneReferenzen(md);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain('https://example.com');
  });
});
