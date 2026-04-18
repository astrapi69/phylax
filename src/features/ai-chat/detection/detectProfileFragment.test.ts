import { describe, it, expect } from 'vitest';
import { detectProfileFragment } from './detectProfileFragment';

describe('detectProfileFragment', () => {
  it('detects a single observation block with the four field markers', () => {
    const message = `Ich strukturiere das als:

### Linke Schulter
- **Status:** Akut
- **Beobachtung:** Schmerzen seit drei Wochen
- **Muster:** Besonders morgens
- **Selbstregulation:** Noch nicht getestet

Moechtest du das so uebernehmen?`;

    const result = detectProfileFragment(message);
    expect(result).not.toBeNull();
    expect(result?.hasObservations).toBe(true);
    expect(result?.observationBlocks).toHaveLength(1);
    expect(result?.observationBlocks[0]).toContain('### Linke Schulter');
    expect(result?.observationBlocks[0]).toContain('- **Status:** Akut');
    expect(result?.markdown).toContain('## Beobachtungen');
  });

  it('ignores ## Laborwerte (out of AI-07 scope) so no false positive fires', () => {
    const message = `Hier die Werte:

## Laborwerte
Letzter Befund: 2026-02-27 (Musterlabor)
- TSH: 4,1 mIU/l`;

    expect(detectProfileFragment(message)).toBeNull();
  });

  it('detects a Supplemente block with a Markdown table (parser-compatible format)', () => {
    const message = `Ich trage ein:

## Supplemente

| Kategorie | Praeparat |
| --- | --- |
| taeglich | Vitamin D3 2000 IE |
| bei Bedarf | Magnesium 400 |`;

    const result = detectProfileFragment(message);
    expect(result?.hasSupplements).toBe(true);
    expect(result?.supplementsBlock).toContain('Vitamin D3');
    expect(result?.supplementsBlock).toContain('| Kategorie');
  });

  it('detects an Offene Punkte block with a context sub-heading', () => {
    const message = `## Offene Punkte

### Beim naechsten Arztbesuch
- Termin beim Orthopaeden vereinbaren
- Wiederholungs-Laborwerte in 4 Wochen`;

    const result = detectProfileFragment(message);
    expect(result?.hasOpenPoints).toBe(true);
    expect(result?.openPointsBlock).toContain('Termin beim Orthopaeden');
    expect(result?.openPointsBlock).toContain('### Beim naechsten Arztbesuch');
  });

  it('detects a mixed fragment (observation + supplement + open points)', () => {
    const message = `Ich trage folgendes ein:

### Knie rechts
- **Status:** Akut
- **Beobachtung:** Schmerzen nach Lauftraining

Und die Supplemente:

## Supplemente

| Kategorie | Praeparat |
| --- | --- |
| taeglich | Magnesium 400 |

Plus offene Punkte:

## Offene Punkte

### Laufen
- Laufschuh-Check`;

    const result = detectProfileFragment(message);
    expect(result?.hasObservations).toBe(true);
    expect(result?.hasSupplements).toBe(true);
    expect(result?.hasOpenPoints).toBe(true);
    expect(result?.markdown).toContain('## Beobachtungen');
    expect(result?.markdown).toContain('## Supplemente');
    expect(result?.markdown).toContain('## Offene Punkte');
  });

  it('returns null for conversational-only content', () => {
    const result = detectProfileFragment(
      'Das klingt nach einer Schulterbelastung. Hast du bemerkt, wann die Schmerzen besonders stark sind?',
    );
    expect(result).toBeNull();
  });

  it('detects a fragment inside a triple-backtick code fence', () => {
    const message =
      'Hier der Block zum Uebernehmen:\n\n```markdown\n### Knie links\n' +
      '- **Status:** Stabil\n- **Beobachtung:** Belastungsabhaengig\n```\n\nAlles klar?';

    const result = detectProfileFragment(message);
    expect(result?.hasObservations).toBe(true);
    expect(result?.observationBlocks[0]).toContain('Knie links');
    expect(result?.observationBlocks[0]).not.toContain('```');
  });

  it('rejects a `### Theme` heading without any observation field marker', () => {
    const message = `### Zusammenfassung

Das Thema ist komplex, wir sollten es strukturiert angehen.
Kein Status-Feld, kein Beobachtung-Feld - das ist KEINE Beobachtung.`;

    expect(detectProfileFragment(message)).toBeNull();
  });

  it('captures two independent observation blocks in one message', () => {
    const message = `### Linke Schulter
- **Status:** Akut
- **Beobachtung:** Schmerzen bei Bankdruecken

### Rechter Ellenbogen
- **Status:** Latent
- **Muster:** Druckabhaengig`;

    const result = detectProfileFragment(message);
    expect(result?.observationBlocks).toHaveLength(2);
    expect(result?.observationBlocks[0]).toContain('Linke Schulter');
    expect(result?.observationBlocks[1]).toContain('Rechter Ellenbogen');
  });

  it('returns null when an observation heading has no following field bullets', () => {
    const message = `### Schulter
Rein erklaerender Text ohne Bullet-Felder.`;
    expect(detectProfileFragment(message)).toBeNull();
  });

  it('rejects observation bullets without the required bold label syntax', () => {
    // Plain `- Status:` is NOT parser-compatible - must be `- **Status:**`.
    const message = `### Schulter
- Status: Akut
- Beobachtung: Schmerzen`;
    expect(detectProfileFragment(message)).toBeNull();
  });

  it('returns null when a level-2 heading matches but has no body lines', () => {
    // Empty "## Offene Punkte" with nothing after it should not be detected.
    const message = `## Offene Punkte

`;
    expect(detectProfileFragment(message)).toBeNull();
  });

  describe('block termination (AI-08a fix)', () => {
    it('trims the trailing "Moechtest du das uebernehmen?" question after an open-points block', () => {
      const message = `Hier ist der Punkt fuer deinen naechsten Arztbesuch:

## Offene Punkte

### Beim naechsten Arztbesuch
- TSH-Wert nachmessen

Moechtest du das so uebernehmen?`;

      const result = detectProfileFragment(message);
      expect(result?.hasOpenPoints).toBe(true);
      expect(result?.openPointsBlock).toContain('TSH-Wert nachmessen');
      expect(result?.openPointsBlock).not.toContain('Moechtest du');
      expect(result?.markdown).not.toContain('Moechtest du');
    });

    it('preserves multiline indented bullet continuations inside an observation block', () => {
      const message = `### Knie rechts
- **Status:** Akut
- **Beobachtung:** Schmerzen nach Lauftraining
  insbesondere bei Bergauflaeufen
  auf hartem Untergrund
- **Muster:** Belastungsabhaengig`;

      const result = detectProfileFragment(message);
      expect(result?.observationBlocks[0]).toContain('insbesondere bei Bergauflaeufen');
      expect(result?.observationBlocks[0]).toContain('auf hartem Untergrund');
    });

    it('excludes a trailing prose sentence that follows the last bullet', () => {
      const message = `## Supplemente

| Kategorie | Praeparat |
| --- | --- |
| taeglich | Magnesium 400 |

Ich hoffe das hilft.`;

      const result = detectProfileFragment(message);
      expect(result?.supplementsBlock).toContain('Magnesium 400');
      expect(result?.supplementsBlock).not.toContain('Ich hoffe');
    });

    it('treats Markdown table rows as content so the whole table stays inside the block', () => {
      const message = `## Supplemente

| Kategorie | Praeparat |
| --- | --- |
| taeglich | Vitamin D3 |
| bei Bedarf | Magnesium 400 |

Noch Fragen?`;

      const result = detectProfileFragment(message);
      expect(result?.supplementsBlock).toContain('| --- | --- |');
      expect(result?.supplementsBlock).toContain('Vitamin D3');
      expect(result?.supplementsBlock).toContain('Magnesium 400');
      expect(result?.supplementsBlock).not.toContain('Noch Fragen');
    });

    it('real-world regression: TSH-Wert nachmessen block produced clean from the AI response', () => {
      // Exact pattern observed in browser testing: the trailing question
      // used to be absorbed into the open-point text.
      const message = `Hier ist der Punkt fuer deinen naechsten Arztbesuch:

## Offene Punkte
### Beim naechsten Arztbesuch
- TSH-Wert nachmessen

Moechtest du das so uebernehmen?`;

      const result = detectProfileFragment(message);
      if (!result) throw new Error('expected a detected fragment');
      expect(result.hasOpenPoints).toBe(true);
      expect(result.openPointsBlock).toBe(
        '## Offene Punkte\n### Beim naechsten Arztbesuch\n- TSH-Wert nachmessen',
      );
    });
  });
});
