import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import i18n from '../../../i18n/config';
import { lock, unlock } from '../../../crypto';
import { setupCompletedOnboarding } from '../../../db/test-helpers';
import { readMeta } from '../../../db/meta';
import {
  ProfileRepository,
  ObservationRepository,
  SupplementRepository,
  OpenPointRepository,
  ProfileVersionRepository,
} from '../../../db/repositories';
import type { Profile } from '../../../domain';
import type {
  ParseResult,
  ParsedObservation,
  ParsedSupplement,
} from '../../profile-import/parser/types';
import { computeDiff } from './computeDiff';
import { commitFragment, commitSummaryText } from './commitFragment';

const t = i18n.getFixedT('de', 'ai-chat');

const TEST_PASSWORD = 'test-password-12';

async function unlockSession(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function seedSession(): Promise<Profile> {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
  return new ProfileRepository().create({
    baseData: {
      name: 'Max',
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
}

function makeParseResult(overrides: Partial<ParseResult> = {}): ParseResult {
  return {
    profile: null,
    observations: [],
    labReports: [],
    labValues: [],
    supplements: [],
    openPoints: [],
    profileVersions: [],
    timelineEntries: [],
    report: { recognized: [], warnings: [], unrecognized: [], metadata: {} },
    originalMarkdown: '',
    ...overrides,
  };
}

function makeParsedObs(theme: string, fields: Partial<ParsedObservation> = {}): ParsedObservation {
  return {
    theme,
    fact: '',
    pattern: '',
    selfRegulation: '',
    status: '',
    source: 'user',
    extraSections: {},
    ...fields,
  };
}

function makeParsedSupplement(
  name: string,
  fields: Partial<ParsedSupplement> = {},
): ParsedSupplement {
  return { name, category: 'daily', ...fields };
}

beforeEach(() => {
  window.localStorage.clear();
});

// `bumpVersion` tests moved to `src/domain/profileVersion/bumpVersion.test.ts`
// when the helper was extracted for shared use with the manual
// base-data-edit path (O-16). The re-export from `commitFragment.ts`
// keeps the public API stable but tests live with the implementation.

describe('commitFragment', () => {
  it('writes new observations with source="ai" and fresh timestamps', async () => {
    const profile = await seedSession();
    const parseResult = makeParseResult({
      observations: [
        makeParsedObs('Knie rechts', {
          status: 'Akut',
          fact: 'Schmerzen nach Lauftraining',
        }),
      ],
    });
    const diff = computeDiff(parseResult, { observations: [], supplements: [] });

    const result = await commitFragment({
      diff,
      versionDescription: 'KI-Update: Knie rechts neu',
      profileId: profile.id,
    });

    expect(result.observationsCreated).toBe(1);
    const stored = await new ObservationRepository().listByProfile(profile.id);
    expect(stored).toHaveLength(1);
    const written = stored[0];
    expect(written?.theme).toBe('Knie rechts');
    expect(written?.status).toBe('Akut');
    expect(written?.fact).toBe('Schmerzen nach Lauftraining');
    expect(written?.source).toBe('ai');
    expect(written?.profileId).toBe(profile.id);
  });

  it('updates an existing observation with merged fields, preserves id + createdAt + source="user"', async () => {
    const profile = await seedSession();
    const obsRepo = new ObservationRepository();
    const existing = await obsRepo.create({
      profileId: profile.id,
      theme: 'Linke Schulter',
      status: 'Chronisch',
      fact: 'Druckschmerz',
      pattern: 'Gurtbelastung',
      selfRegulation: 'SCM-Routine',
      source: 'user',
      extraSections: {},
    });
    const originalCreatedAt = existing.createdAt;

    const parseResult = makeParseResult({
      observations: [
        makeParsedObs('Linke Schulter', {
          status: 'Stabil',
          fact: 'Weniger Druckschmerz',
        }),
      ],
    });
    const diff = computeDiff(parseResult, { observations: [existing], supplements: [] });

    await commitFragment({
      diff,
      versionDescription: 'KI-Update: Linke Schulter aktualisiert',
      profileId: profile.id,
    });

    const stored = await obsRepo.getById(existing.id);
    expect(stored?.id).toBe(existing.id);
    expect(stored?.createdAt).toBe(originalCreatedAt);
    expect(stored?.status).toBe('Stabil');
    expect(stored?.fact).toBe('Weniger Druckschmerz');
    // Empty incoming pattern / selfRegulation keep existing values
    expect(stored?.pattern).toBe('Gurtbelastung');
    expect(stored?.selfRegulation).toBe('SCM-Routine');
    // User-sourced observations stay 'user' on AI-assisted updates
    expect(stored?.source).toBe('user');
  });

  it('creates new supplements and updates existing ones', async () => {
    const profile = await seedSession();
    const supRepo = new SupplementRepository();
    const existing = await supRepo.create({
      profileId: profile.id,
      name: 'Magnesium 400',
      category: 'daily',
    });

    const parseResult = makeParseResult({
      supplements: [
        makeParsedSupplement('Magnesium 400', { category: 'paused' }),
        makeParsedSupplement('Vitamin D3', { category: 'daily' }),
      ],
    });
    const diff = computeDiff(parseResult, { observations: [], supplements: [existing] });

    const result = await commitFragment({
      diff,
      versionDescription: 'KI-Update: 2 Supplemente',
      profileId: profile.id,
    });

    expect(result.supplementsCreated).toBe(1);
    expect(result.supplementsUpdated).toBe(1);
    const all = await supRepo.listByProfile(profile.id);
    expect(all).toHaveLength(2);
    const magnesium = all.find((s) => s.name === 'Magnesium 400');
    expect(magnesium?.id).toBe(existing.id);
    expect(magnesium?.category).toBe('paused');
    const vitaminD = all.find((s) => s.name === 'Vitamin D3');
    expect(vitaminD?.category).toBe('daily');
  });

  it('creates new open points with context and priority preserved', async () => {
    const profile = await seedSession();
    const parseResult = makeParseResult({
      openPoints: [
        {
          text: 'TSH-Wert nachmessen',
          context: 'Beim nächsten Arztbesuch',
          resolved: false,
          priority: 'Hoch',
        },
        {
          text: 'MRT Knie rechts besprechen',
          context: 'Beim nächsten Arztbesuch',
          resolved: false,
        },
      ],
    });
    const diff = computeDiff(parseResult, { observations: [], supplements: [] });

    await commitFragment({
      diff,
      versionDescription: 'KI-Update: 2 Punkte',
      profileId: profile.id,
    });

    const stored = await new OpenPointRepository().listByProfile(profile.id);
    expect(stored).toHaveLength(2);
    const tsh = stored.find((p) => p.text === 'TSH-Wert nachmessen');
    expect(tsh?.context).toBe('Beim nächsten Arztbesuch');
    expect(tsh?.priority).toBe('Hoch');
    expect(tsh?.resolved).toBe(false);
  });

  it('bumps Profile.version and creates a matching ProfileVersion entry', async () => {
    const profile = await seedSession();
    const parseResult = makeParseResult({
      observations: [makeParsedObs('Knie rechts', { status: 'Akut' })],
    });
    const diff = computeDiff(parseResult, { observations: [], supplements: [] });

    const result = await commitFragment({
      diff,
      versionDescription: 'KI-Update: Knie rechts neu',
      profileId: profile.id,
    });

    expect(result.newVersion).toBe('1.0.1');
    const updated = await new ProfileRepository().getById(profile.id);
    expect(updated?.version).toBe('1.0.1');

    const versions = await new ProfileVersionRepository().listByProfile(profile.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.version).toBe('1.0.1');
    expect(versions[0]?.changeDescription).toBe('KI-Update: Knie rechts neu');
    expect(versions[0]?.changeDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('commits multiple entity types in one atomic transaction', async () => {
    const profile = await seedSession();
    const parseResult = makeParseResult({
      observations: [makeParsedObs('Knie rechts', { status: 'Akut' })],
      supplements: [makeParsedSupplement('Magnesium 400', { category: 'daily' })],
      openPoints: [
        { text: 'MRT besprechen', context: 'Beim nächsten Arztbesuch', resolved: false },
      ],
    });
    const diff = computeDiff(parseResult, { observations: [], supplements: [] });

    const result = await commitFragment({
      diff,
      versionDescription: 'KI-Update: gemischt',
      profileId: profile.id,
    });

    expect(result).toEqual({
      observationsCreated: 1,
      observationsUpdated: 0,
      supplementsCreated: 1,
      supplementsUpdated: 0,
      openPointsCreated: 1,
      newVersion: '1.0.1',
    });
    expect(await new ObservationRepository().listByProfile(profile.id)).toHaveLength(1);
    expect(await new SupplementRepository().listByProfile(profile.id)).toHaveLength(1);
    expect(await new OpenPointRepository().listByProfile(profile.id)).toHaveLength(1);
    expect(await new ProfileVersionRepository().listByProfile(profile.id)).toHaveLength(1);
  });

  it('throws "App wurde gesperrt"-style error when the key store is locked', async () => {
    const profile = await seedSession();
    const parseResult = makeParseResult({
      observations: [makeParsedObs('Knie rechts', { status: 'Akut' })],
    });
    const diff = computeDiff(parseResult, { observations: [], supplements: [] });
    lock();

    await expect(
      commitFragment({
        diff,
        versionDescription: 'KI-Update: Knie rechts neu',
        profileId: profile.id,
      }),
    ).rejects.toThrow();
    // No rows were written - pre-encryption failed before any Dexie call.
    expect(await new ObservationRepository().listByProfile(profile.id)).toHaveLength(0);
  });

  it('throws when the profile id is missing', async () => {
    await seedSession();
    const parseResult = makeParseResult({
      observations: [makeParsedObs('Knie rechts', { status: 'Akut' })],
    });
    const diff = computeDiff(parseResult, { observations: [], supplements: [] });
    await expect(
      commitFragment({
        diff,
        versionDescription: 'KI-Update',
        profileId: 'does-not-exist',
      }),
    ).rejects.toThrow(/Profil nicht gefunden/);
  });

  it('commits a degenerate empty diff (only the version entry) cleanly', async () => {
    const profile = await seedSession();
    const diff = computeDiff(makeParseResult(), { observations: [], supplements: [] });

    const result = await commitFragment({
      diff,
      versionDescription: 'Manueller Versionsanker',
      profileId: profile.id,
    });

    expect(result.newVersion).toBe('1.0.1');
    const versions = await new ProfileVersionRepository().listByProfile(profile.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.changeDescription).toBe('Manueller Versionsanker');
  });

  it('two consecutive commits bump the version twice', async () => {
    const profile = await seedSession();
    const parseResult = makeParseResult({
      observations: [makeParsedObs('Knie rechts', { status: 'Akut' })],
    });
    const firstDiff = computeDiff(parseResult, { observations: [], supplements: [] });
    const firstResult = await commitFragment({
      diff: firstDiff,
      versionDescription: 'KI-Update 1',
      profileId: profile.id,
    });
    expect(firstResult.newVersion).toBe('1.0.1');

    // Second commit: a different new observation on the (now v1.0.1) profile.
    const parse2 = makeParseResult({
      observations: [makeParsedObs('Schulter', { status: 'Chronisch' })],
    });
    const existingObs = await new ObservationRepository().listByProfile(profile.id);
    const secondDiff = computeDiff(parse2, { observations: existingObs, supplements: [] });
    const secondResult = await commitFragment({
      diff: secondDiff,
      versionDescription: 'KI-Update 2',
      profileId: profile.id,
    });
    expect(secondResult.newVersion).toBe('1.0.2');
    expect((await new ProfileRepository().getById(profile.id))?.version).toBe('1.0.2');
  });
});

describe('commitSummaryText', () => {
  it('names only non-empty categories with German pluralization', () => {
    expect(
      commitSummaryText(t, {
        observationsCreated: 1,
        observationsUpdated: 1,
        supplementsCreated: 0,
        supplementsUpdated: 0,
        openPointsCreated: 3,
        newVersion: '1.0.1',
      }),
    ).toBe(
      'Profil-Update gespeichert: 2 Beobachtungen, 3 offene Punkte übernommen (Version 1.0.1).',
    );
  });

  it('singular wording for lone items', () => {
    expect(
      commitSummaryText(t, {
        observationsCreated: 1,
        observationsUpdated: 0,
        supplementsCreated: 1,
        supplementsUpdated: 0,
        openPointsCreated: 1,
        newVersion: '1.0.1',
      }),
    ).toBe(
      'Profil-Update gespeichert: 1 Beobachtung, 1 Supplement, 1 offener Punkt übernommen (Version 1.0.1).',
    );
  });

  it('degenerate commit produces a minimal sentence', () => {
    expect(
      commitSummaryText(t, {
        observationsCreated: 0,
        observationsUpdated: 0,
        supplementsCreated: 0,
        supplementsUpdated: 0,
        openPointsCreated: 0,
        newVersion: '1.0.1',
      }),
    ).toBe('Profil-Update gespeichert (Version 1.0.1).');
  });
});
