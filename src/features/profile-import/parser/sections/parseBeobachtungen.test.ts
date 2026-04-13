import { describe, it, expect } from 'vitest';
import { parseBeobachtungen } from './parseBeobachtungen';

describe('parseBeobachtungen', () => {
  it('parses a basic observation with all core fields', () => {
    const md = [
      '### 2.1 Linkes Knie',
      '- **Beobachtung:** Schmerzen bei Belastung.',
      '- **Muster:** Belastungsabhaengig, nie in Ruhe.',
      '- **Selbstregulation:** Training angepasst.',
      '- **Status:** Chronisch-rezidivierend',
    ].join('\n');

    const { observations, warnings } = parseBeobachtungen(md);
    expect(observations).toHaveLength(1);
    expect(observations[0]?.theme).toBe('Linkes Knie');
    expect(observations[0]?.fact).toBe('Schmerzen bei Belastung.');
    expect(observations[0]?.pattern).toBe('Belastungsabhaengig, nie in Ruhe.');
    expect(observations[0]?.selfRegulation).toBe('Training angepasst.');
    expect(observations[0]?.status).toBe('Chronisch-rezidivierend');
    expect(warnings).toHaveLength(0);
  });

  it('parses multiple observations', () => {
    const md = [
      '### 2.1 Knie',
      '- **Beobachtung:** Fact 1',
      '- **Muster:** Pattern 1',
      '- **Selbstregulation:** Reg 1',
      '- **Status:** Active',
      '### 2.2 Schulter',
      '- **Beobachtung:** Fact 2',
      '- **Muster:** Pattern 2',
      '- **Selbstregulation:** Reg 2',
      '- **Status:** Stable',
    ].join('\n');

    const { observations } = parseBeobachtungen(md);
    expect(observations).toHaveLength(2);
    expect(observations[0]?.theme).toBe('Knie');
    expect(observations[1]?.theme).toBe('Schulter');
  });

  it('maps extra labels to extraSections', () => {
    const md = [
      '### 2.1 Schulter',
      '- **Beobachtung:** Fact',
      '- **Ursprung:** Detailed origin story.',
      '- **Kausalitaetskette:** Gurt -> Vorschaedigung',
      '- **Muster:** Pattern',
      '- **Selbstregulation:** Reg',
      '- **Status:** Active',
    ].join('\n');

    const { observations } = parseBeobachtungen(md);
    expect(observations[0]?.extraSections['Ursprung']).toBe('Detailed origin story.');
    expect(observations[0]?.extraSections['Kausalitaetskette']).toBe('Gurt -> Vorschaedigung');
  });

  it('maps relevance notes', () => {
    const md = [
      '### 2.1 Test',
      '- **Beobachtung:** F',
      '- **Muster:** M',
      '- **Selbstregulation:** S',
      '- **Status:** A',
      '- **Relevanz fuer Abnehmziel:** Gelenkbelastung bei Uebergewicht.',
    ].join('\n');

    const { observations } = parseBeobachtungen(md);
    expect(observations[0]?.relevanceNotes).toBe('Gelenkbelastung bei Uebergewicht.');
  });

  it('detects AI source from Einschaetzung text', () => {
    const md = [
      '### 2.1 Test',
      '- **Beobachtung:** F',
      '- **Muster:** M',
      '- **Selbstregulation:** S',
      '- **Status:** A',
      '- **Einschaetzung:** Selbst + KI-gestuetzt',
    ].join('\n');

    const { observations } = parseBeobachtungen(md);
    expect(observations[0]?.source).toBe('ai');
    expect(observations[0]?.extraSections['Einschaetzung']).toBe('Selbst + KI-gestuetzt');
  });

  it('strips version markers from theme', () => {
    const md =
      '### 2.5 Ernaehrung (NEU v1.3)\n- **Beobachtung:** F\n- **Muster:** M\n- **Selbstregulation:** S\n- **Status:** A';
    const { observations } = parseBeobachtungen(md);
    expect(observations[0]?.theme).toBe('Ernaehrung');
  });

  it('warns on observation with no core fields', () => {
    const md = '### 2.1 Empty\nJust some text without labeled bullets.';
    const { observations, warnings } = parseBeobachtungen(md);
    expect(observations).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toContain('no fact, pattern, or self-regulation');
  });

  it('preserves multi-line selfRegulation', () => {
    const md = [
      '### Test',
      '- **Beobachtung:** F',
      '- **Muster:** M',
      '- **Selbstregulation:**',
      '  - Face Pulls 3x/Woche',
      '  - Kein Ueberkopf-Druecken',
      '- **Status:** Active',
    ].join('\n');

    const { observations } = parseBeobachtungen(md);
    expect(observations[0]?.selfRegulation).toContain('Face Pulls');
    expect(observations[0]?.selfRegulation).toContain('Kein Ueberkopf');
  });

  it('handles medical finding', () => {
    const md = [
      '### Test',
      '- **Beobachtung:** F',
      '- **Aerztlicher Befund:** Impingement-Syndrom, konservativ',
      '- **Muster:** M',
      '- **Selbstregulation:** S',
      '- **Status:** A',
    ].join('\n');

    const { observations } = parseBeobachtungen(md);
    expect(observations[0]?.medicalFinding).toBe('Impingement-Syndrom, konservativ');
  });
});
