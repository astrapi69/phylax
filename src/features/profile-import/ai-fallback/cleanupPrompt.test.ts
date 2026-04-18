import { describe, it, expect } from 'vitest';
import { CLEANUP_SYSTEM_PROMPT, isImpossibleResponse } from './cleanupPrompt';

describe('CLEANUP_SYSTEM_PROMPT', () => {
  it('describes all four target section structures', () => {
    expect(CLEANUP_SYSTEM_PROMPT).toContain('### [Thema]');
    expect(CLEANUP_SYSTEM_PROMPT).toContain('## Supplemente');
    expect(CLEANUP_SYSTEM_PROMPT).toContain('## Offene Punkte');
    expect(CLEANUP_SYSTEM_PROMPT).toContain('## Basisdaten');
  });

  it('explicitly forbids fabrication and ambiguous guessing', () => {
    expect(CLEANUP_SYSTEM_PROMPT).toMatch(/erfinde nichts/i);
    expect(CLEANUP_SYSTEM_PROMPT).toMatch(/lieber weglassen als raten/i);
  });

  it('names the NICHT_VERARBEITBAR fallback sentinel', () => {
    expect(CLEANUP_SYSTEM_PROMPT).toContain('NICHT_VERARBEITBAR');
  });

  it('forbids conversational framing and demands direct Markdown output', () => {
    expect(CLEANUP_SYSTEM_PROMPT).toMatch(/Keine Konversation/);
    expect(CLEANUP_SYSTEM_PROMPT).toMatch(/ohne Einleitung/);
  });
});

describe('isImpossibleResponse', () => {
  it('matches the exact sentinel', () => {
    expect(isImpossibleResponse('NICHT_VERARBEITBAR')).toBe(true);
  });

  it('matches a short sentence containing the sentinel', () => {
    expect(isImpossibleResponse('Das ist leider NICHT_VERARBEITBAR.')).toBe(true);
  });

  it('matches spaced-out variants via whitespace normalization', () => {
    expect(isImpossibleResponse('NICHT VERARBEITBAR')).toBe(true);
    expect(isImpossibleResponse('nicht verarbeitbar')).toBe(true);
  });

  it('does not match a long structured Markdown reply that happens to mention the word', () => {
    const longReply =
      '### Knie\n- Status: Akut\n- Beobachtung: Schmerz\n- Muster: belastung\n- Selbstregulation: NICHT_VERARBEITBAR im Alltag';
    expect(isImpossibleResponse(longReply)).toBe(false);
  });

  it('does not match empty or whitespace-only output', () => {
    expect(isImpossibleResponse('')).toBe(false);
    expect(isImpossibleResponse('   \n  ')).toBe(false);
  });
});
