import { describe, it, expect } from 'vitest';
import { parseLabeledBullets } from './parseLabeledBullets';

describe('parseLabeledBullets', () => {
  it('parses single labeled bullet', () => {
    const result = parseLabeledBullets('- **Beobachtung:** Schmerz beim Training.');
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe('Beobachtung');
    expect(result[0]?.value).toBe('Schmerz beim Training.');
  });

  it('parses multiple bullets', () => {
    const md = [
      '- **Beobachtung:** Fact text',
      '- **Muster:** Pattern text',
      '- **Status:** Active',
    ].join('\n');
    const result = parseLabeledBullets(md);
    expect(result).toHaveLength(3);
    expect(result[0]?.label).toBe('Beobachtung');
    expect(result[1]?.label).toBe('Muster');
    expect(result[2]?.label).toBe('Status');
  });

  it('handles multi-line values', () => {
    const md = [
      '- **Selbstregulation:**',
      '  - Face Pulls 3x/Woche',
      '  - Kein Ueberkopf-Druecken',
      '  - Rotatorenmanschette kraeftigen',
    ].join('\n');
    const result = parseLabeledBullets(md);
    expect(result).toHaveLength(1);
    expect(result[0]?.value).toContain('Face Pulls');
    expect(result[0]?.value).toContain('Kein Ueberkopf');
  });

  it('handles bold label without dash prefix', () => {
    const result = parseLabeledBullets('**Einschaetzung:** Unauffaellig.');
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe('Einschaetzung');
  });

  it('handles colon outside bold markers', () => {
    const result = parseLabeledBullets('- **Status**: Chronisch');
    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe('Status');
    expect(result[0]?.value).toBe('Chronisch');
  });

  it('returns empty array for no bullets', () => {
    const result = parseLabeledBullets('Just plain text without any labeled bullets.');
    expect(result).toEqual([]);
  });

  it('preserves Markdown formatting in values', () => {
    const md = '- **Details:** Text with **bold** and *italic* and `code`.';
    const result = parseLabeledBullets(md);
    expect(result[0]?.value).toContain('**bold**');
    expect(result[0]?.value).toContain('*italic*');
  });
});
