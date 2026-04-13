import { describe, it, expect } from 'vitest';
import { splitIntoSections } from './splitIntoSections';

describe('splitIntoSections', () => {
  it('splits on H2 headings', () => {
    const md = '## Section A\nContent A\n## Section B\nContent B';
    const sections = splitIntoSections(md);
    expect(sections).toHaveLength(3); // preamble + 2 sections
    expect(sections[1]?.heading).toBe('Section A');
    expect(sections[1]?.content).toBe('Content A');
    expect(sections[2]?.heading).toBe('Section B');
    expect(sections[2]?.content).toBe('Content B');
  });

  it('captures content before first heading', () => {
    const md = 'Preamble text\n## First';
    const sections = splitIntoSections(md);
    expect(sections[0]?.heading).toBe('');
    expect(sections[0]?.content).toBe('Preamble text');
  });

  it('handles no headings', () => {
    const md = 'Just plain text\nNo headings here';
    const sections = splitIntoSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.content).toContain('Just plain text');
  });

  it('handles empty input', () => {
    const sections = splitIntoSections('');
    expect(sections).toHaveLength(1);
    expect(sections[0]?.content).toBe('');
  });

  it('splits on H3 when minLevel=3', () => {
    const md = '## Parent\n### Child A\nA content\n### Child B\nB content';
    const sections = splitIntoSections(md, 3);
    expect(sections).toHaveLength(3);
    expect(sections[1]?.heading).toBe('Child A');
    expect(sections[2]?.heading).toBe('Child B');
  });

  it('preserves multi-line content', () => {
    const md = '## Section\nLine 1\nLine 2\n\nLine 3';
    const sections = splitIntoSections(md);
    expect(sections[1]?.content).toBe('Line 1\nLine 2\n\nLine 3');
  });

  it('handles numbered headings like "## 1. Basisdaten"', () => {
    const md = '## 1. Basisdaten\nData\n## 2. Beobachtungen\nObs';
    const sections = splitIntoSections(md);
    expect(sections[1]?.heading).toBe('1. Basisdaten');
    expect(sections[2]?.heading).toBe('2. Beobachtungen');
  });
});
