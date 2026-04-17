import { describe, it, expect } from 'vitest';
import type { Profile, Observation } from '../../../domain';
import { generateSystemPrompt } from './systemPrompt';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  const now = Date.UTC(2026, 2, 15);
  const base: Profile = {
    id: 'p1',
    profileId: 'p1',
    createdAt: now,
    updatedAt: now,
    baseData: {
      name: 'Max Mustermann',
      age: 43,
      weightHistory: [],
      knownDiagnoses: ['Impingement links'],
      currentMedications: [],
      relevantLimitations: [],
      profileType: 'self',
    },
    warningSigns: [],
    externalReferences: [],
    version: '1.0',
  };
  return { ...base, ...overrides, baseData: { ...base.baseData, ...overrides.baseData } };
}

function proxyProfile(): Profile {
  return makeProfile({
    baseData: {
      ...makeProfile().baseData,
      profileType: 'proxy',
      managedBy: 'Anna Mueller',
      name: 'Mutter',
    },
  });
}

function makeObservation(theme: string): Observation {
  return {
    id: `obs-${theme}`,
    profileId: 'p1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    theme,
    fact: '',
    pattern: '',
    selfRegulation: '',
    status: '',
    source: 'user',
    extraSections: {},
  };
}

describe('generateSystemPrompt', () => {
  describe('role and core contract', () => {
    it('names the assistant role and denies medical authority', () => {
      const prompt = generateSystemPrompt({ profile: makeProfile(), observations: [] });
      expect(prompt).toMatch(/Strukturierungsassistent/);
      expect(prompt).toMatch(/kein Arzt/);
    });

    it('includes the fact / pattern / self-regulation triad', () => {
      const prompt = generateSystemPrompt({ profile: makeProfile(), observations: [] });
      expect(prompt).toMatch(/Fakt/);
      expect(prompt).toMatch(/Muster/);
      expect(prompt).toMatch(/Selbstregulation/);
    });
  });

  describe('boundaries contract', () => {
    it('forbids diagnosis within the NICHT section', () => {
      const prompt = generateSystemPrompt({ profile: makeProfile(), observations: [] });
      const forbidden = prompt.split('Du DARFST:')[0] ?? '';
      expect(forbidden).toMatch(/Du darfst NICHT:/);
      expect(forbidden).toMatch(/Diagnosen stellen oder vorschlagen/);
    });

    it('forbids treatment and dosage recommendations', () => {
      const prompt = generateSystemPrompt({ profile: makeProfile(), observations: [] });
      const forbidden = prompt.split('Du DARFST:')[0] ?? '';
      expect(forbidden).toMatch(/Behandlungen, Medikamente oder Dosierungen/);
    });

    it('forbids clinical interpretation of lab values', () => {
      const prompt = generateSystemPrompt({ profile: makeProfile(), observations: [] });
      const forbidden = prompt.split('Du DARFST:')[0] ?? '';
      expect(forbidden).toMatch(/klinische Bedeutung nicht/);
    });

    it('forbids framing diet or training plans as medical advice', () => {
      const prompt = generateSystemPrompt({ profile: makeProfile(), observations: [] });
      const forbidden = prompt.split('Du DARFST:')[0] ?? '';
      expect(forbidden).toMatch(/Ernaehrungsplaene, Diaeten oder Trainingsplaene/);
    });

    it('forbids contradicting the doctor and advising medication changes', () => {
      const prompt = generateSystemPrompt({ profile: makeProfile(), observations: [] });
      const forbidden = prompt.split('Du DARFST:')[0] ?? '';
      expect(forbidden).toMatch(/Dem Arzt des Nutzers widersprechen/);
      expect(forbidden).toMatch(/verschriebene Medikamente abzusetzen oder zu aendern/);
    });

    it('forbids emergency medical advice', () => {
      const prompt = generateSystemPrompt({ profile: makeProfile(), observations: [] });
      const forbidden = prompt.split('Du DARFST:')[0] ?? '';
      expect(forbidden).toMatch(/Notfallberatung/);
    });

    it('permits suggesting a doctor visit without justification', () => {
      const prompt = generateSystemPrompt({ profile: makeProfile(), observations: [] });
      const allowed = prompt.split('Du DARFST:')[1] ?? '';
      expect(allowed).toMatch(/Arztbesuch sinnvoll sein koennte/);
      expect(allowed).toMatch(/ohne zu sagen warum/);
    });
  });

  describe('output format', () => {
    it('includes the Phylax profile-output format contract in every prompt', () => {
      const prompt = generateSystemPrompt({ profile: makeProfile(), observations: [] });
      expect(prompt).toMatch(/Format fuer Profil-Aenderungen/);
      expect(prompt).toContain('### [Thema]');
      expect(prompt).toContain('## Supplemente');
      expect(prompt).toContain('## Offene Punkte');
    });
  });

  describe('uncertainty marking', () => {
    it('instructs the model to flag uncertainty and not fabricate', () => {
      const prompt = generateSystemPrompt({ profile: makeProfile(), observations: [] });
      expect(prompt).toContain('Nicht sicher, ob dies unter');
      expect(prompt).toContain('Zu klaeren:');
      expect(prompt).toMatch(/Erfinde keine Informationen/);
    });
  });

  describe('proxy extension', () => {
    it('self profiles do NOT include the proxy extension', () => {
      const prompt = generateSystemPrompt({ profile: makeProfile(), observations: [] });
      expect(prompt).not.toMatch(/stellvertretend gefuehrt/);
      expect(prompt).not.toMatch(/Betreuer\/in/);
    });

    it('proxy profiles include the extension with managedBy and subject name', () => {
      const prompt = generateSystemPrompt({ profile: proxyProfile(), observations: [] });
      expect(prompt).toMatch(/stellvertretend gefuehrt/);
      expect(prompt).toContain('Betreuer/in: Anna Mueller');
      expect(prompt).toMatch(/hat\s+Mutter\s+dir das erzaehlt/);
    });

    it('proxy profiles include the beobachtet vs berichtet distinction', () => {
      const prompt = generateSystemPrompt({ profile: proxyProfile(), observations: [] });
      expect(prompt).toContain('"Beobachtet"');
      expect(prompt).toContain('"Berichtet"');
    });
  });

  describe('profile summary injection', () => {
    it('includeProfileSummary=true injects the current profile section', () => {
      const prompt = generateSystemPrompt({
        profile: makeProfile(),
        observations: [makeObservation('Schulter'), makeObservation('Schlaf')],
        includeProfileSummary: true,
      });
      expect(prompt).toContain('Aktuelles Profil:');
      expect(prompt).toContain('- Name: Max Mustermann');
      expect(prompt).toContain('- Bestehende Beobachtungsthemen: Schlaf, Schulter');
    });

    it('includeProfileSummary=false omits the current profile section', () => {
      const prompt = generateSystemPrompt({
        profile: makeProfile(),
        observations: [makeObservation('Schulter')],
        includeProfileSummary: false,
      });
      expect(prompt).not.toContain('Aktuelles Profil');
    });

    it('defaults to including the profile summary', () => {
      const prompt = generateSystemPrompt({ profile: makeProfile() });
      expect(prompt).toContain('Aktuelles Profil:');
    });
  });

  describe('composition', () => {
    it('joins sections with blank lines (no runaway concatenation)', () => {
      const prompt = generateSystemPrompt({ profile: makeProfile(), observations: [] });
      // Every section header should be preceded by a blank line, except the first.
      expect(prompt.split('\n\n').length).toBeGreaterThanOrEqual(5);
    });

    it('starts with the role definition', () => {
      const prompt = generateSystemPrompt({ profile: makeProfile(), observations: [] });
      expect(prompt.startsWith('Du bist ein Strukturierungsassistent')).toBe(true);
    });
  });
});
