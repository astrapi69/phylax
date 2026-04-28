import { describe, it, expect } from 'vitest';
import { findMatchRanges, splitQuery } from './searchMatches';

describe('splitQuery', () => {
  it('splits whitespace-separated terms and normalizes', () => {
    expect(splitQuery('Foo Bar')).toEqual(['foo', 'bar']);
  });

  it('returns empty array for empty or whitespace-only input', () => {
    expect(splitQuery('')).toEqual([]);
    expect(splitQuery('   ')).toEqual([]);
  });

  it('normalizes diacritics on each term', () => {
    expect(splitQuery('Müller café')).toEqual(['muller', 'cafe']);
  });
});

describe('findMatchRanges', () => {
  it('returns empty array when no terms', () => {
    expect(findMatchRanges('hello', [])).toEqual([]);
  });

  it('returns empty array when text is empty', () => {
    expect(findMatchRanges('', ['foo'])).toEqual([]);
  });

  it('finds a single occurrence in plain ASCII', () => {
    expect(findMatchRanges('hello world', ['world'])).toEqual([{ start: 6, end: 11 }]);
  });

  it('finds multiple occurrences of the same term', () => {
    expect(findMatchRanges('test test test', ['test'])).toEqual([
      { start: 0, end: 4 },
      { start: 5, end: 9 },
      { start: 10, end: 14 },
    ]);
  });

  it('is case-insensitive (terms expected pre-normalized via splitQuery)', () => {
    // Original-text normalization is internal; terms must already be lowercase.
    expect(findMatchRanges('Hello World', ['hello'])).toEqual([{ start: 0, end: 5 }]);
    expect(findMatchRanges('Hello World', splitQuery('HELLO'))).toEqual([{ start: 0, end: 5 }]);
  });

  it('finds matches across diacritics in NFC original text', () => {
    // "Müller" (NFC) — ü is one character, normalizes to "u"
    // Query "muller" should match the entire string.
    const ranges = findMatchRanges('Müller', ['muller']);
    expect(ranges).toEqual([{ start: 0, end: 6 }]);
  });

  it('does NOT transliterate ue to umlaut-u', () => {
    expect(findMatchRanges('Müller', ['mueller'])).toEqual([]);
  });

  it('merges overlapping ranges from multiple terms', () => {
    // "tester" matches "test" at [0,4] and "es" at [1,3] — merges to [0,4].
    const ranges = findMatchRanges('tester', ['test', 'es']);
    expect(ranges).toEqual([{ start: 0, end: 4 }]);
  });

  it('returns sorted ranges across multiple terms', () => {
    // Query "abc xyz" matches at positions 0 and 4 in "abc xyz"
    expect(findMatchRanges('abc xyz', ['xyz', 'abc'])).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 7 },
    ]);
  });

  it('finds a match at the end of the text', () => {
    expect(findMatchRanges('foo bar', ['bar'])).toEqual([{ start: 4, end: 7 }]);
  });

  it('handles non-overlapping repeated terms', () => {
    expect(findMatchRanges('aabaa', ['aa'])).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 5 },
    ]);
  });

  it('handles a term longer than the text by returning empty', () => {
    expect(findMatchRanges('hi', ['hello'])).toEqual([]);
  });

  it('matches a normalized term against original text with diacritic', () => {
    // Caller normalizes terms via splitQuery; here we pass the normalized form.
    expect(findMatchRanges('café', splitQuery('café'))).toEqual([{ start: 0, end: 4 }]);
  });
});
