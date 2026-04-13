import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock } from '../../crypto';
import { setupCompletedOnboarding } from '../test-helpers';
import { ProfileRepository } from './profileRepository';
import { ObservationRepository } from './observationRepository';
import type { Observation } from '../../domain';

const TEST_PASSWORD = 'test-password-12';

let profileId: string;
let repo: ObservationRepository;

function makeObsData(
  overrides: Partial<Omit<Observation, 'id' | 'createdAt' | 'updatedAt'>> = {},
): Omit<Observation, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId: overrides.profileId ?? profileId,
    theme: overrides.theme ?? 'Schulter (links)',
    fact: overrides.fact ?? 'Schmerz bei Banddrücken ueber Kopf.',
    pattern: overrides.pattern ?? 'Nur unter Belastung, nie in Ruhe.',
    selfRegulation: overrides.selfRegulation ?? 'Training angepasst.',
    status: overrides.status ?? 'Chronisch-rezidivierend',
    source: overrides.source ?? 'user',
    medicalFinding: overrides.medicalFinding,
    relevanceNotes: overrides.relevanceNotes,
    extraSections: overrides.extraSections ?? {},
  };
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const { readMeta } = await import('../meta');
  const { unlock } = await import('../../crypto');
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

  // Create a profile to get a valid profileId
  const profileRepo = new ProfileRepository();
  const profile = await profileRepo.create({
    baseData: {
      weightHistory: [],
      knownDiagnoses: [],
      currentMedications: [],
      relevantLimitations: [],
      profileType: 'self',
    },
    warningSigns: [],
    externalReferences: [],
    version: '1.0.0',
  });
  profileId = profile.id;
  repo = new ObservationRepository();
});

describe('ObservationRepository', () => {
  describe('extraSections round-trip', () => {
    it('German keys map survives round-trip', async () => {
      const sections = {
        Ursprung: 'Detaillierte Vorgeschichte seit 2018.',
        Kausalitaetskette: 'Gurt -> Vorschaedigung -> SCM-Kompensation',
        'Sekundaere Ursache': 'SCM-Muskel als Mitverursacher',
        Einschaetzung: 'Selbst + KI-gestuetzt',
      };
      const obs = await repo.create(makeObsData({ extraSections: sections }));
      const fetched = await repo.getById(obs.id);

      expect(fetched?.extraSections).toEqual(sections);
      expect(Object.keys(fetched?.extraSections ?? {})).toHaveLength(4);
      lock();
    });

    it('empty extraSections survives as empty object', async () => {
      const obs = await repo.create(makeObsData({ extraSections: {} }));
      const fetched = await repo.getById(obs.id);

      expect(fetched?.extraSections).toEqual({});
      expect(fetched?.extraSections).not.toBeUndefined();
      lock();
    });

    it('single empty-string value survives', async () => {
      const obs = await repo.create(makeObsData({ extraSections: { Vorgeschichte: '' } }));
      const fetched = await repo.getById(obs.id);

      expect(fetched?.extraSections['Vorgeschichte']).toBe('');
      lock();
    });

    it('Markdown content in values survives', async () => {
      const markdown = '- Punkt 1\n- Punkt 2\n- **Wichtig:** fett gedruckt\n\nZweiter Absatz.';
      const obs = await repo.create(makeObsData({ extraSections: { Ursprung: markdown } }));
      const fetched = await repo.getById(obs.id);

      expect(fetched?.extraSections['Ursprung']).toBe(markdown);
      lock();
    });

    it('Umlauts and special characters survive', async () => {
      const sections = {
        'Aerztliche Einschaetzung': 'Ueber 50% Verlust, groesser als erwartet.',
        Note: 'Temperatur 37.5-38.5 Grad C. Puls >100. Wert <0.5.',
        Umlaute: 'Aerztliche Befunde: aehnlich wie frueher, oeffentlich zugaenglich.',
      };
      const obs = await repo.create(makeObsData({ extraSections: sections }));
      const fetched = await repo.getById(obs.id);

      expect(fetched?.extraSections).toEqual(sections);
      lock();
    });

    it('emoji in values survives', async () => {
      const sections = { Stimmung: 'Traurig \u{1F614} aber besser \u{1F642}' };
      const obs = await repo.create(makeObsData({ extraSections: sections }));
      const fetched = await repo.getById(obs.id);

      expect(fetched?.extraSections['Stimmung']).toBe(sections['Stimmung']);
      lock();
    });

    it('very long value (10,000 chars) survives', async () => {
      const longValue = 'Detaillierte Vorgeschichte. '.repeat(400).trim(); // ~11,200 chars
      const obs = await repo.create(makeObsData({ extraSections: { Ursprung: longValue } }));
      const fetched = await repo.getById(obs.id);

      expect(fetched?.extraSections['Ursprung']).toBe(longValue);
      lock();
    });

    it('50 keys all survive', async () => {
      const sections: Record<string, string> = {};
      for (let i = 1; i <= 50; i++) {
        sections[`Section${i}`] = `Wert fuer Section ${i}`;
      }
      const obs = await repo.create(makeObsData({ extraSections: sections }));
      const fetched = await repo.getById(obs.id);

      expect(Object.keys(fetched?.extraSections ?? {})).toHaveLength(50);
      expect(fetched?.extraSections).toEqual(sections);
      lock();
    });

    it('preserves insertion order of extraSections keys through round-trip', async () => {
      const obs = await repo.create(
        makeObsData({
          extraSections: {
            ZuersteSection: 'first',
            ZweiteSection: 'second',
            DritteSection: 'third',
            VierteSection: 'fourth',
          },
        }),
      );
      const fetched = await repo.getById(obs.id);

      expect(fetched).not.toBeNull();
      const keys = Object.keys(fetched?.extraSections ?? {});
      expect(keys).toEqual(['ZuersteSection', 'ZweiteSection', 'DritteSection', 'VierteSection']);
      lock();
    });
  });

  describe('theme methods', () => {
    it('listByTheme filters correctly', async () => {
      await repo.create(makeObsData({ theme: 'Schulter' }));
      await repo.create(makeObsData({ theme: 'Schulter' }));
      await repo.create(makeObsData({ theme: 'Knie' }));
      await repo.create(makeObsData({ theme: 'Knie' }));
      await repo.create(makeObsData({ theme: 'Ernaehrung' }));

      const shoulder = await repo.listByTheme(profileId, 'Schulter');
      expect(shoulder).toHaveLength(2);
      for (const obs of shoulder) {
        expect(obs.theme).toBe('Schulter');
      }
      lock();
    });

    it('listThemes returns deduplicated set', async () => {
      await repo.create(makeObsData({ theme: 'Schulter' }));
      await repo.create(makeObsData({ theme: 'Schulter' }));
      await repo.create(makeObsData({ theme: 'Knie' }));
      await repo.create(makeObsData({ theme: 'Ernaehrung' }));

      const themes = await repo.listThemes(profileId);
      expect(themes.sort()).toEqual(['Ernaehrung', 'Knie', 'Schulter']);
      lock();
    });

    it('listThemes on empty profile returns empty array', async () => {
      const themes = await repo.listThemes(profileId);
      expect(themes).toEqual([]);
      lock();
    });
  });

  describe('source values', () => {
    it('all three source values round-trip', async () => {
      const user = await repo.create(makeObsData({ source: 'user' }));
      const ai = await repo.create(makeObsData({ source: 'ai' }));
      const medical = await repo.create(makeObsData({ source: 'medical' }));

      expect((await repo.getById(user.id))?.source).toBe('user');
      expect((await repo.getById(ai.id))?.source).toBe('ai');
      expect((await repo.getById(medical.id))?.source).toBe('medical');
      lock();
    });
  });

  describe('optional fields', () => {
    it('medicalFinding and relevanceNotes preserved when present', async () => {
      const obs = await repo.create(
        makeObsData({
          medicalFinding: 'Impingement-Syndrom, konservativ',
          relevanceNotes: 'Relevant fuer Abnehmziel: Gelenkbelastung bei Uebergewicht.',
        }),
      );
      const fetched = await repo.getById(obs.id);

      expect(fetched?.medicalFinding).toBe('Impingement-Syndrom, konservativ');
      expect(fetched?.relevanceNotes).toBe(
        'Relevant fuer Abnehmziel: Gelenkbelastung bei Uebergewicht.',
      );
      lock();
    });

    it('optional fields are undefined when absent', async () => {
      const obs = await repo.create(makeObsData());
      const fetched = await repo.getById(obs.id);

      expect(fetched?.medicalFinding).toBeUndefined();
      expect(fetched?.relevanceNotes).toBeUndefined();
      lock();
    });
  });

  describe('status and core triad', () => {
    it('multi-word status phrase preserved exactly', async () => {
      const status = 'Chronisch-rezidivierend, Ursache identifiziert (Eigenanamnese)';
      const obs = await repo.create(makeObsData({ status }));
      const fetched = await repo.getById(obs.id);

      expect(fetched?.status).toBe(status);
      lock();
    });

    it('selfRegulation with Markdown bullet list round-trips', async () => {
      const selfReg = [
        '- **Gurt-Management:** Gurtpolster im Auto, Sicherheitsgurt bewusst adjustieren',
        '- **SCM-Release:** Regelmaessige Selbstmassage des M. sternocleidomastoideus',
        '- **Face Pulls:** 3x/Woche, leichtes Gewicht, hohe Wiederholungen',
        '- **Training-Anpassung:** Kein Ueberkopf-Druecken, stattdessen Schraegbank',
      ].join('\n');
      const obs = await repo.create(makeObsData({ selfRegulation: selfReg }));
      const fetched = await repo.getById(obs.id);

      expect(fetched?.selfRegulation).toBe(selfReg);
      lock();
    });
  });

  describe('inherited base class behaviors', () => {
    it('auto-generates id and timestamps on create', async () => {
      const before = Date.now();
      const obs = await repo.create(makeObsData());
      const after = Date.now();

      expect(obs.id).toMatch(/^[0-9a-f]{8}-/);
      expect(obs.createdAt).toBeGreaterThanOrEqual(before);
      expect(obs.createdAt).toBeLessThanOrEqual(after);
      lock();
    });

    it('update throws on immutable fields', async () => {
      const obs = await repo.create(makeObsData());

      await expect(repo.update(obs.id, { id: 'new' } as Partial<Observation>)).rejects.toThrow(
        'Cannot modify immutable fields',
      );

      lock();
    });

    it('delete removes the observation', async () => {
      const obs = await repo.create(makeObsData());
      await repo.delete(obs.id);
      expect(await repo.getById(obs.id)).toBeNull();
      lock();
    });

    it('listByProfile filters by profileId', async () => {
      await repo.create(makeObsData({ profileId }));
      await repo.create(makeObsData({ profileId }));
      await repo.create(makeObsData({ profileId: 'other-profile' }));

      const results = await repo.listByProfile(profileId);
      expect(results).toHaveLength(2);
      lock();
    });
  });
});
