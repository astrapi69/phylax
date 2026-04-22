import { describe, it, expect } from 'vitest';
import { parseSupplements } from './parseSupplements';

describe('parseSupplements', () => {
  it('parses a standard supplements table', () => {
    const md = [
      '| Kategorie | Praeparat | Empfehlung | Begründung |',
      '|-----------|-----------|------------|-------------|',
      '| **Beibehalten (täglich)** | Vitamin D3 2000 IE (tetesept) | Morgens | Empfohlen nach Bluttest |',
      '| | Omega-3 | Abends | Entzuendungshemmend |',
    ].join('\n');

    const result = parseSupplements(md);
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe('Vitamin D3 2000 IE');
    expect(result[0]?.brand).toBe('tetesept');
    expect(result[0]?.category).toBe('daily');
    expect(result[0]?.recommendation).toBe('Morgens');
    expect(result[0]?.rationale).toBe('Empfohlen nach Bluttest');
    // Second row inherits category from first
    expect(result[1]?.name).toBe('Omega-3');
    expect(result[1]?.category).toBe('daily');
  });

  it('maps all category types', () => {
    const md = [
      '| Kategorie | Praeparat | Empfehlung | Begründung |',
      '|-----------|-----------|------------|-------------|',
      '| **Beibehalten (täglich)** | A | | |',
      '| **Beibehalten (3-4x/Woche)** | B | | |',
      '| **Pausiert** | C | | |',
      '| **Bei Bedarf** | D | | |',
    ].join('\n');

    const result = parseSupplements(md);
    expect(result[0]?.category).toBe('daily');
    expect(result[1]?.category).toBe('regular');
    expect(result[2]?.category).toBe('paused');
    expect(result[3]?.category).toBe('on-demand');
  });

  it('parses name without brand', () => {
    const md = [
      '| Kategorie | Praeparat | Empfehlung | Begründung |',
      '|-----------|-----------|------------|-------------|',
      '| Täglich | Magnesium 400mg | Abends | |',
    ].join('\n');

    const result = parseSupplements(md);
    expect(result[0]?.name).toBe('Magnesium 400mg');
    expect(result[0]?.brand).toBeUndefined();
  });

  it('handles empty content', () => {
    expect(parseSupplements('')).toEqual([]);
  });

  it('skips rows without praeparat', () => {
    const md = [
      '| Kategorie | Praeparat | Empfehlung | Begründung |',
      '|-----------|-----------|------------|-------------|',
      '| Täglich | | Morgens | Reason |',
    ].join('\n');

    expect(parseSupplements(md)).toEqual([]);
  });

  it('handles optional fields as undefined', () => {
    const md = [
      '| Kategorie | Praeparat | Empfehlung | Begründung |',
      '|-----------|-----------|------------|-------------|',
      '| Täglich | Vitamin C | | |',
    ].join('\n');

    const result = parseSupplements(md);
    expect(result[0]?.recommendation).toBeUndefined();
    expect(result[0]?.rationale).toBeUndefined();
  });
});
