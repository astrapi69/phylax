import { describe, it, expect } from 'vitest';
import {
  ROLE_DEFINITION,
  STRUCTURE_CONTRACT,
  BOUNDARIES,
  UNCERTAINTY_MARKING,
  PROFILE_OUTPUT_FORMAT,
  GUIDED_SESSION_FRAMING,
  proxyExtensionFragment,
} from './promptFragments';

describe('promptFragments', () => {
  describe('ROLE_DEFINITION', () => {
    it('identifies the role as Strukturierungsassistent and denies medical authority', () => {
      expect(ROLE_DEFINITION).toMatch(/Strukturierungsassistent/);
      expect(ROLE_DEFINITION).toMatch(/kein Arzt/);
      expect(ROLE_DEFINITION).toMatch(/keine medizinischen Ratschläge/);
    });
  });

  describe('STRUCTURE_CONTRACT', () => {
    it('contains the fact / pattern / self-regulation triad', () => {
      expect(STRUCTURE_CONTRACT).toMatch(/Fakt/);
      expect(STRUCTURE_CONTRACT).toMatch(/Muster/);
      expect(STRUCTURE_CONTRACT).toMatch(/Selbstregulation/);
    });

    it('lists the six profile sections', () => {
      expect(STRUCTURE_CONTRACT).toMatch(/Basisdaten/);
      expect(STRUCTURE_CONTRACT).toMatch(/Beobachtungen/);
      expect(STRUCTURE_CONTRACT).toMatch(/Blutwerte/);
      expect(STRUCTURE_CONTRACT).toMatch(/Supplemente/);
      expect(STRUCTURE_CONTRACT).toMatch(/Offene Punkte/);
      expect(STRUCTURE_CONTRACT).toMatch(/Verlaufsnotizen/);
    });
  });

  describe('BOUNDARIES', () => {
    it('has both forbidden and allowed sections', () => {
      expect(BOUNDARIES).toMatch(/Du darfst NICHT:/);
      expect(BOUNDARIES).toMatch(/Du DARFST:/);
    });

    it('forbids all six critical categories (contract-level)', () => {
      // Each forbidden concept must appear somewhere in the NICHT block
      const [forbiddenBlock] = BOUNDARIES.split('Du DARFST:');
      expect(forbiddenBlock).toBeDefined();
      const block = forbiddenBlock ?? '';
      expect(block).toMatch(/Diagnosen stellen oder vorschlagen/i);
      expect(block).toMatch(/Behandlungen.*empfehlen|Medikamente.*empfehlen/i);
      expect(block).toMatch(/klinische Bedeutung/i);
      expect(block).toMatch(/Ernährungspläne|Diäten|Trainingspläne/i);
      expect(block).toMatch(/widerspr/i);
      expect(block).toMatch(/Notfallberatung/i);
      expect(block).toMatch(/Medikamente.*(absetzen|ändern)/i);
    });

    it('permits suggesting a doctor visit without saying why', () => {
      const allowedBlock = BOUNDARIES.split('Du DARFST:')[1] ?? '';
      expect(allowedBlock).toMatch(/Arztbesuch sinnvoll sein könnte/i);
      expect(allowedBlock).toMatch(/ohne zu sagen warum/i);
    });
  });

  describe('UNCERTAINTY_MARKING', () => {
    it('contains all three uncertainty markers', () => {
      expect(UNCERTAINTY_MARKING).toContain('Nicht sicher, ob dies unter');
      expect(UNCERTAINTY_MARKING).toContain('Zu klären:');
      expect(UNCERTAINTY_MARKING).toContain('Hinweis: Diese Information scheint unvollständig.');
    });

    it('instructs the model not to fabricate', () => {
      expect(UNCERTAINTY_MARKING).toMatch(/Erfinde keine Informationen/);
    });
  });

  describe('PROFILE_OUTPUT_FORMAT', () => {
    it('names the three supported block types', () => {
      expect(PROFILE_OUTPUT_FORMAT).toContain('### [Thema]');
      expect(PROFILE_OUTPUT_FORMAT).toContain('## Supplemente');
      expect(PROFILE_OUTPUT_FORMAT).toContain('## Offene Punkte');
    });

    it('excludes Laborwerte from chat-structured output', () => {
      expect(PROFILE_OUTPUT_FORMAT).toMatch(/Laborwerte werden nicht im Chat strukturiert/);
    });

    it('documents the supplement table categories', () => {
      expect(PROFILE_OUTPUT_FORMAT).toContain('täglich');
      expect(PROFILE_OUTPUT_FORMAT).toContain('regelmäßig');
      expect(PROFILE_OUTPUT_FORMAT).toContain('bei Bedarf');
      expect(PROFILE_OUTPUT_FORMAT).toContain('pausiert');
    });

    it('forbids the outer "# Profil:" wrapper', () => {
      expect(PROFILE_OUTPUT_FORMAT).toMatch(/Kein "# Profil: \.\.\." am Anfang/);
    });

    it('tells the model to skip the format for questions or pure explanations', () => {
      expect(PROFILE_OUTPUT_FORMAT).toMatch(/nur eine Frage stellt/);
      expect(PROFILE_OUTPUT_FORMAT).toMatch(/keinen Block erzeugen/);
    });

    it('provides contrasting positive and negative examples', () => {
      expect(PROFILE_OUTPUT_FORMAT).toMatch(/Beispiel OHNE Format/);
      expect(PROFILE_OUTPUT_FORMAT).toMatch(/Beispiel MIT Format/);
    });
  });

  describe('GUIDED_SESSION_FRAMING', () => {
    it('names all three in-scope sections for the guided session', () => {
      expect(GUIDED_SESSION_FRAMING).toMatch(/Beobachtungen/);
      expect(GUIDED_SESSION_FRAMING).toMatch(/Supplemente/);
      expect(GUIDED_SESSION_FRAMING).toMatch(/Offene Punkte/);
    });

    it('names the sections that are explicitly out of scope', () => {
      expect(GUIDED_SESSION_FRAMING).toMatch(/Basisdaten/);
      expect(GUIDED_SESSION_FRAMING).toMatch(/Laborwerte/);
      expect(GUIDED_SESSION_FRAMING).toMatch(/Verlaufsnotizen/);
    });
  });

  describe('proxyExtensionFragment', () => {
    it('interpolates the caregiver name', () => {
      const text = proxyExtensionFragment('Anna Mueller', 'Mutter');
      expect(text).toContain('Betreuer/in: Anna Mueller');
    });

    it('uses the subject name in the clarifying question when provided', () => {
      const text = proxyExtensionFragment('Anna Mueller', 'Mutter');
      expect(text).toMatch(/hat\s+Mutter\s+dir das erzählt/);
    });

    it('falls back to "die betroffene Person" when subject name is blank', () => {
      const text = proxyExtensionFragment('Anna Mueller', '   ');
      expect(text).toMatch(/hat\s+die betroffene Person\s+dir das erzählt/);
    });

    it('falls back to "(nicht angegeben)" when caregiver is blank', () => {
      const text = proxyExtensionFragment('', 'Mutter');
      expect(text).toContain('Betreuer/in: (nicht angegeben)');
      expect(text).not.toContain('Betreuer/in: undefined');
    });

    it('includes the beobachtet vs berichtet distinction', () => {
      const text = proxyExtensionFragment('Anna', 'Mutter');
      expect(text).toContain('"Beobachtet"');
      expect(text).toContain('"Berichtet"');
    });

    it('includes a sensitivity reminder', () => {
      const text = proxyExtensionFragment('Anna', 'Mutter');
      expect(text).toMatch(/sensibel/i);
      expect(text).toMatch(/eingeschränkt[\s\S]*Selbstauskunft/i);
    });
  });
});
