import { describe, it, expect } from 'vitest';
import { normalizeForSearch } from './normalizeForSearch';

describe('normalizeForSearch', () => {
  it('lowercases ASCII input', () => {
    expect(normalizeForSearch('FOO')).toBe('foo');
    expect(normalizeForSearch('FooBar')).toBe('foobar');
  });

  it('strips German umlaut diacritics', () => {
    expect(normalizeForSearch('Müller')).toBe('muller');
    expect(normalizeForSearch('Ärger')).toBe('arger');
    expect(normalizeForSearch('Öl')).toBe('ol');
  });

  it('strips French and Spanish accents', () => {
    expect(normalizeForSearch('café')).toBe('cafe');
    expect(normalizeForSearch('niño')).toBe('nino');
    expect(normalizeForSearch('résumé')).toBe('resume');
  });

  it('does not transliterate ue to umlaut-u', () => {
    expect(normalizeForSearch('Mueller')).toBe('mueller');
    expect(normalizeForSearch('Müller')).toBe('muller');
    expect(normalizeForSearch('Mueller')).not.toBe(normalizeForSearch('Müller'));
  });

  it('preserves ß as-is (not a combining mark)', () => {
    expect(normalizeForSearch('Straße')).toBe('straße');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeForSearch('')).toBe('');
  });

  it('preserves spaces and punctuation', () => {
    expect(normalizeForSearch('Hello, world!')).toBe('hello, world!');
  });
});
