import { describe, it, expect } from 'vitest';
import { parseRichText, type RichBlock } from './richText';

function blockAt(blocks: RichBlock[], i: number): RichBlock {
  const b = blocks[i];
  if (!b) throw new Error(`no block at index ${i} (length ${blocks.length})`);
  return b;
}

describe('parseRichText', () => {
  it('returns no blocks for empty / whitespace input', () => {
    expect(parseRichText('')).toEqual([]);
    expect(parseRichText('   \n  \n')).toEqual([]);
  });

  it('returns a single paragraph for a plain string', () => {
    expect(parseRichText('Hello world')).toEqual([
      { kind: 'paragraph', runs: [{ text: 'Hello world', style: 'normal' }] },
    ]);
  });

  it('parses inline bold markers', () => {
    const blocks = parseRichText('Wert **kritisch** niedrig');
    expect(blocks).toHaveLength(1);
    expect(blockAt(blocks, 0).runs).toEqual([
      { text: 'Wert ', style: 'normal' },
      { text: 'kritisch', style: 'bold' },
      { text: ' niedrig', style: 'normal' },
    ]);
  });

  it('parses inline italic markers', () => {
    const blocks = parseRichText('Heute *deutlich* besser');
    expect(blockAt(blocks, 0).runs).toEqual([
      { text: 'Heute ', style: 'normal' },
      { text: 'deutlich', style: 'italic' },
      { text: ' besser', style: 'normal' },
    ]);
  });

  it('parses combined bold + italic', () => {
    const blocks = parseRichText('***ganz wichtig***');
    // **...** flips bold, then * flips italic - so the inner text is bolditalic.
    expect(blockAt(blocks, 0).runs).toEqual([{ text: 'ganz wichtig', style: 'bolditalic' }]);
  });

  it('parses __bold__ alternative syntax', () => {
    const blocks = parseRichText('A __strong__ B');
    expect(blockAt(blocks, 0).runs).toEqual([
      { text: 'A ', style: 'normal' },
      { text: 'strong', style: 'bold' },
      { text: ' B', style: 'normal' },
    ]);
  });

  it('splits blocks on blank line', () => {
    const blocks = parseRichText('First paragraph.\n\nSecond paragraph.');
    expect(blocks).toHaveLength(2);
    expect(blockAt(blocks, 0).kind).toBe('paragraph');
    expect(blockAt(blocks, 1).kind).toBe('paragraph');
  });

  it('treats single newlines inside a block as separate paragraphs', () => {
    const blocks = parseRichText('Line one\nLine two');
    expect(blocks).toHaveLength(2);
  });

  it('parses bullet list with dash marker', () => {
    const blocks = parseRichText('- Eisen\n- Magnesium\n- Vitamin D');
    expect(blocks).toHaveLength(3);
    expect(blocks.every((b) => b.kind === 'bullet')).toBe(true);
    expect(blockAt(blocks, 0).runs[0]?.text).toBe('Eisen');
  });

  it('parses bullet list with asterisk and plus markers', () => {
    const blocks = parseRichText('* A\n+ B');
    expect(blocks).toHaveLength(2);
    expect(blockAt(blocks, 0).kind).toBe('bullet');
    expect(blockAt(blocks, 1).kind).toBe('bullet');
  });

  it('strips headings but keeps the text as a paragraph', () => {
    const blocks = parseRichText('# Title\n\nBody');
    expect(blocks).toHaveLength(2);
    expect(blockAt(blocks, 0).runs[0]?.text).toBe('Title');
    expect(blockAt(blocks, 0).kind).toBe('paragraph');
  });

  it('strips inline code, keeping contents', () => {
    const blocks = parseRichText('Try `npm test` now');
    expect(blockAt(blocks, 0).runs[0]?.text).toContain('npm test');
  });

  it('strips link syntax, keeping the visible text', () => {
    const blocks = parseRichText('See [docs](https://example.com) for more');
    const joined = blockAt(blocks, 0)
      .runs.map((r) => r.text)
      .join('');
    expect(joined).toContain('docs');
    expect(joined).not.toContain('https://');
    expect(joined).not.toContain('](');
  });

  it('strips blockquote markers', () => {
    const blocks = parseRichText('> Important note');
    expect(blockAt(blocks, 0).kind).toBe('paragraph');
    expect(blockAt(blocks, 0).runs[0]?.text).toBe('Important note');
  });

  it('strips horizontal rules', () => {
    const blocks = parseRichText('Above\n\n---\n\nBelow');
    const texts = blocks.map((b) => b.runs.map((r) => r.text).join(''));
    expect(texts).toContain('Above');
    expect(texts).toContain('Below');
    expect(texts.some((t) => t.includes('---'))).toBe(false);
  });

  it('mixes bullet items and paragraphs', () => {
    const blocks = parseRichText('Intro paragraph\n\n- Item one\n- Item two\n\nClosing');
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'bullet', 'bullet', 'paragraph']);
  });
});
