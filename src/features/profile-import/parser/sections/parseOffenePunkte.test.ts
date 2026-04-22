import { describe, it, expect } from 'vitest';
import { parseOffenePunkte } from './parseOffenePunkte';

describe('parseOffenePunkte', () => {
  it('parses bullets grouped by context', () => {
    const md = [
      '### Beim nächsten Arztbesuch',
      '- Vitamin D nachkontrollieren',
      '- TSH bestimmen lassen',
      '### Laufend beobachten',
      '- Gewichtsverlauf dokumentieren',
    ].join('\n');

    const result = parseOffenePunkte(md);
    expect(result).toHaveLength(3);
    expect(result[0]?.context).toBe('Beim nächsten Arztbesuch');
    expect(result[0]?.text).toBe('Vitamin D nachkontrollieren');
    expect(result[1]?.text).toBe('TSH bestimmen lassen');
    expect(result[2]?.context).toBe('Laufend beobachten');
  });

  it('all points start as unresolved', () => {
    const md = '### Context\n- Point 1\n- Point 2';
    const result = parseOffenePunkte(md);
    for (const p of result) {
      expect(p.resolved).toBe(false);
    }
  });

  it('extracts priority from heading', () => {
    const md = '### Blutabnahme (Prioritaet)\n- Nuechtern erscheinen';
    const result = parseOffenePunkte(md);
    expect(result[0]?.context).toBe('Blutabnahme');
    expect(result[0]?.priority).toBe('Hoch');
  });

  it('extracts named priority', () => {
    const md = '### Test (Prioritaet: Mittel)\n- Item';
    const result = parseOffenePunkte(md);
    expect(result[0]?.priority).toBe('Mittel');
  });

  it('handles section with no bullets as single point', () => {
    const md = '### Dermatologen-Termin\nTermin vereinbaren für Hautcheck.';
    const result = parseOffenePunkte(md);
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toContain('Hautcheck');
  });

  it('handles empty content', () => {
    expect(parseOffenePunkte('')).toEqual([]);
  });

  it('preserves multi-line bullet content', () => {
    const md = [
      '### Test',
      '- **Wasser trinken** vor der Blutabnahme',
      '  (0,5-1l am Morgen)',
    ].join('\n');

    const result = parseOffenePunkte(md);
    expect(result[0]?.text).toContain('Wasser trinken');
    expect(result[0]?.text).toContain('0,5-1l');
  });
});
