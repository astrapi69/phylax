import { describe, it, expect } from 'vitest';
import { parseVerlaufsnotizen } from './parseVerlaufsnotizen';

describe('parseVerlaufsnotizen', () => {
  it('parses timeline entry with period and title', () => {
    const md = [
      '### Dezember 2024 - Brustkorbbeschwerden',
      '- Ausloeser: Kalte Luft',
      '- Verlauf: Mehrere Tage',
    ].join('\n');

    const result = parseVerlaufsnotizen(md);
    expect(result).toHaveLength(1);
    expect(result[0]?.period).toBe('Dezember 2024');
    expect(result[0]?.title).toBe('Brustkorbbeschwerden');
    expect(result[0]?.content).toContain('Kalte Luft');
    expect(result[0]?.source).toBe('user');
  });

  it('handles heading without dash (period only)', () => {
    const md = '### Maerz 2026\n- Some notes';
    const result = parseVerlaufsnotizen(md);
    expect(result[0]?.period).toBe('Maerz 2026');
    expect(result[0]?.title).toBe('');
  });

  it('parses multiple entries', () => {
    const md = [
      '### Dezember 2024 - Event A',
      'Content A',
      '### Maerz 2026 - Event B',
      'Content B',
    ].join('\n');

    const result = parseVerlaufsnotizen(md);
    expect(result).toHaveLength(2);
    expect(result[0]?.period).toBe('Dezember 2024');
    expect(result[1]?.period).toBe('Maerz 2026');
  });

  it('strips version markers from heading', () => {
    const md = '### Maerz 2026 - Plan (NEU v1.3)\nContent';
    const result = parseVerlaufsnotizen(md);
    expect(result[0]?.title).toBe('Plan');
  });

  it('handles empty content', () => {
    expect(parseVerlaufsnotizen('')).toEqual([]);
  });

  it('preserves Markdown in content', () => {
    const md = '### Jan 2025 - Test\n- **Bold** item\n- *Italic* item';
    const result = parseVerlaufsnotizen(md);
    expect(result[0]?.content).toContain('**Bold**');
    expect(result[0]?.content).toContain('*Italic*');
  });
});
