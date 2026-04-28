import { describe, it, expect } from 'vitest';
import { stripMarkdown } from './markdownStripper';

describe('stripMarkdown', () => {
  it('returns empty string for empty input', () => {
    expect(stripMarkdown('')).toBe('');
    expect(stripMarkdown('   ')).toBe('');
  });

  it('strips bold with ** and __', () => {
    expect(stripMarkdown('Ein **wichtiger** Hinweis')).toBe('Ein wichtiger Hinweis');
    expect(stripMarkdown('Ein __wichtiger__ Hinweis')).toBe('Ein wichtiger Hinweis');
  });

  it('strips italic with single * and _', () => {
    expect(stripMarkdown('Ein *kursiver* Text')).toBe('Ein kursiver Text');
    expect(stripMarkdown('Ein _kursiver_ Text')).toBe('Ein kursiver Text');
  });

  it('strips strikethrough', () => {
    expect(stripMarkdown('Ein ~~alter~~ Begriff')).toBe('Ein alter Begriff');
  });

  it('strips inline code', () => {
    expect(stripMarkdown('Code wie `git status`')).toBe('Code wie git status');
  });

  it('preserves code-fence contents and drops fences', () => {
    expect(stripMarkdown('```\nfoo\nbar\n```')).toBe('foo\nbar');
    expect(stripMarkdown('```js\nconst x = 1;\n```')).toBe('const x = 1;');
  });

  it('strips heading markers', () => {
    expect(stripMarkdown('# Titel')).toBe('Titel');
    expect(stripMarkdown('### Unterabschnitt')).toBe('Unterabschnitt');
  });

  it('strips blockquote markers', () => {
    expect(stripMarkdown('> Zitat')).toBe('Zitat');
    expect(stripMarkdown('>Zitat ohne Leerzeichen')).toBe('Zitat ohne Leerzeichen');
  });

  it('expands link to "text (url)"', () => {
    expect(stripMarkdown('Siehe [Phylax](https://example.com)')).toBe(
      'Siehe Phylax (https://example.com)',
    );
  });

  it('expands image to "[alt] (url)"', () => {
    expect(stripMarkdown('Bild ![Logo](logo.png)')).toBe('Bild [Logo] (logo.png)');
  });

  it('normalizes bullet markers to -', () => {
    expect(stripMarkdown('* Eins\n+ Zwei\n- Drei')).toBe('- Eins\n- Zwei\n- Drei');
  });

  it('preserves numbered list ordering', () => {
    expect(stripMarkdown('1. Erstes\n2. Zweites')).toBe('1. Erstes\n2. Zweites');
  });

  it('drops horizontal rules', () => {
    expect(stripMarkdown('Vor\n---\nNach')).toBe('Vor\n\nNach');
  });

  it('collapses excessive blank lines', () => {
    expect(stripMarkdown('A\n\n\n\nB')).toBe('A\n\nB');
  });

  it('handles multiple transforms in one input', () => {
    const input = '## Befund\n\n**Wichtig:** *bald* nachuntersuchen.\n\n- TSH `1.2`\n- T4 normal';
    expect(stripMarkdown(input)).toBe(
      'Befund\n\nWichtig: bald nachuntersuchen.\n\n- TSH 1.2\n- T4 normal',
    );
  });

  it('preserves diacritics and unicode content unchanged', () => {
    expect(stripMarkdown('**Müller** mit Umlaut')).toBe('Müller mit Umlaut');
  });
});
