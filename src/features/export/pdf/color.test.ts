import { describe, it, expect } from 'vitest';
import { classifyAssessment, Palette } from './color';

describe('classifyAssessment', () => {
  it('returns "normal" for undefined', () => {
    expect(classifyAssessment(undefined)).toBe('normal');
  });

  it('returns "normal" for empty string', () => {
    expect(classifyAssessment('')).toBe('normal');
  });

  it('returns "normal" for the literal "normal"', () => {
    expect(classifyAssessment('normal')).toBe('normal');
  });

  it('returns "critical" for "kritisch" (lowercase)', () => {
    expect(classifyAssessment('kritisch')).toBe('critical');
  });

  it('returns "critical" for mixed-case "Kritisch"', () => {
    expect(classifyAssessment('Kritisch erhöht')).toBe('critical');
  });

  it('returns "critical" for "kritisch" embedded in a longer phrase', () => {
    expect(classifyAssessment('Wert kritisch niedrig')).toBe('critical');
  });

  it.each([
    ['unterhalb Referenz'],
    ['Oberhalb des Bereichs'],
    ['erhöht'],
    ['erhoeht'],
    ['erniedrigt'],
    ['grenzwertig'],
    ['leicht erhöht'],
    ['Wert ist erniedrigt'],
  ])('returns "notable" for %s', (input) => {
    expect(classifyAssessment(input)).toBe('notable');
  });

  it('prefers "critical" over "notable" when both markers are present', () => {
    expect(classifyAssessment('kritisch erniedrigt')).toBe('critical');
  });

  it('returns "normal" for unrelated assessments', () => {
    expect(classifyAssessment('Sieht gut aus')).toBe('normal');
    expect(classifyAssessment('im Zielbereich')).toBe('normal');
  });
});

describe('Palette', () => {
  it('exposes RGB triples in 0..255', () => {
    const entries = Object.entries(Palette);
    expect(entries.length).toBeGreaterThan(0);
    for (const [name, rgb] of entries) {
      expect(rgb, name).toHaveLength(3);
      for (const ch of rgb) {
        expect(ch, name).toBeGreaterThanOrEqual(0);
        expect(ch, name).toBeLessThanOrEqual(255);
      }
    }
  });
});
