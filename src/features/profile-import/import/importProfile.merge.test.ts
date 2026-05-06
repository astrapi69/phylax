import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../../crypto';
import { setupCompletedOnboarding } from '../../../db/test-helpers';
import { readMeta } from '../../../db/meta';
import {
  ProfileRepository,
  ObservationRepository,
  SupplementRepository,
  OpenPointRepository,
  ProfileVersionRepository,
  TimelineEntryRepository,
} from '../../../db/repositories';
import { importProfile } from './importProfile';
import { UnresolvedConflictError } from '../../../domain/import-merge';
import type { ParseResult } from '../parser/types';

const TEST_PASSWORD = 'test-password-12';
let profileId: string;

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

  const profileRepo = new ProfileRepository();
  const profile = await profileRepo.create({
    baseData: {
      name: 'Mein Profil',
      weightHistory: [],
      knownDiagnoses: [],
      currentMedications: [],
      relevantLimitations: [],
      profileType: 'self',
    },
    warningSigns: [],
    externalReferences: [],
    version: '1.0',
  });
  profileId = profile.id;
});

function emptyParseResult(overrides: Partial<ParseResult> = {}): ParseResult {
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

function obs(
  theme: string,
  fact = `${theme} fact`,
  status = 'Stabil',
): ParseResult['observations'][number] {
  return {
    theme,
    fact,
    pattern: '',
    selfRegulation: '',
    status,
    source: 'user',
    extraSections: {},
  };
}

describe('importProfile merge mode (IM-06)', () => {
  it('merge into empty target = pure inserts (no existing rows to match)', async () => {
    const result = await importProfile(
      emptyParseResult({ observations: [obs('Knie'), obs('Schulter')] }),
      profileId,
      { replaceExisting: { observations: 'merge' } },
    );
    const repo = new ObservationRepository();
    const stored = await repo.listByProfile(profileId);
    expect(stored).toHaveLength(2);
    expect(stored.map((o) => o.theme).sort()).toEqual(['Knie', 'Schulter']);
    expect(result.replaced).toBe(false);
  });

  it('merge with disjoint themes appends without touching existing rows', async () => {
    const obsRepo = new ObservationRepository();
    await obsRepo.create({
      profileId,
      theme: 'Existing',
      fact: 'untouched',
      pattern: '',
      selfRegulation: '',
      status: 'Stabil',
      source: 'user',
      extraSections: {},
    });
    await importProfile(emptyParseResult({ observations: [obs('Hüfte')] }), profileId, {
      replaceExisting: { observations: 'merge' },
    });
    const stored = await obsRepo.listByProfile(profileId);
    expect(stored).toHaveLength(2);
    const existing = stored.find((o) => o.theme === 'Existing');
    expect(existing?.fact).toBe('untouched');
  });

  it('merge with identical theme + identical fields = no-op (no duplicate row)', async () => {
    const obsRepo = new ObservationRepository();
    await obsRepo.create({
      profileId,
      theme: 'Knie',
      fact: 'same fact',
      pattern: '',
      selfRegulation: '',
      status: 'Stabil',
      source: 'user',
      extraSections: {},
    });
    await importProfile(
      emptyParseResult({ observations: [obs('Knie', 'same fact', 'Stabil')] }),
      profileId,
      { replaceExisting: { observations: 'merge' } },
    );
    const stored = await obsRepo.listByProfile(profileId);
    expect(stored).toHaveLength(1);
  });

  it('merge with same theme + differing fact + resolution=mine preserves existing', async () => {
    const obsRepo = new ObservationRepository();
    const existingEntity = await obsRepo.create({
      profileId,
      theme: 'Knie',
      fact: 'mine fact',
      pattern: '',
      selfRegulation: '',
      status: 'Stabil',
      source: 'user',
      extraSections: {},
    });
    await importProfile(
      emptyParseResult({ observations: [obs('Knie', 'theirs fact')] }),
      profileId,
      {
        replaceExisting: { observations: 'merge' },
        resolutions: {
          observations: {
            [existingEntity.id]: { kind: 'mine' },
          },
        },
      },
    );
    const stored = await obsRepo.listByProfile(profileId);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.fact).toBe('mine fact');
  });

  it('merge with same theme + differing fact + resolution=theirs overwrites the field', async () => {
    const obsRepo = new ObservationRepository();
    const existingEntity = await obsRepo.create({
      profileId,
      theme: 'Knie',
      fact: 'mine fact',
      pattern: '',
      selfRegulation: '',
      status: 'Stabil',
      source: 'user',
      extraSections: {},
    });
    await importProfile(
      emptyParseResult({ observations: [obs('Knie', 'theirs fact')] }),
      profileId,
      {
        replaceExisting: { observations: 'merge' },
        resolutions: {
          observations: {
            [existingEntity.id]: { kind: 'theirs' },
          },
        },
      },
    );
    const stored = await obsRepo.listByProfile(profileId);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.fact).toBe('theirs fact');
    // Same row id (we updated, not inserted).
    expect(stored[0]?.id).toBe(existingEntity.id);
  });

  it('merge field-by-field: per-field choices land in the patch', async () => {
    const obsRepo = new ObservationRepository();
    const existingEntity = await obsRepo.create({
      profileId,
      theme: 'Knie',
      fact: 'mine-fact',
      pattern: '',
      selfRegulation: '',
      status: 'mine-status',
      source: 'user',
      extraSections: {},
    });
    await importProfile(
      emptyParseResult({
        observations: [
          {
            theme: 'Knie',
            fact: 'theirs-fact',
            pattern: '',
            selfRegulation: '',
            status: 'theirs-status',
            source: 'user',
            extraSections: {},
          },
        ],
      }),
      profileId,
      {
        replaceExisting: { observations: 'merge' },
        resolutions: {
          observations: {
            [existingEntity.id]: {
              kind: 'field-by-field',
              fieldChoices: { fact: 'theirs', status: 'mine' },
            },
          },
        },
      },
    );
    const stored = await obsRepo.listByProfile(profileId);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.fact).toBe('theirs-fact');
    expect(stored[0]?.status).toBe('mine-status');
  });

  it('merge throws UnresolvedConflictError when a conflict lacks a resolution; vault unchanged', async () => {
    const obsRepo = new ObservationRepository();
    const existingEntity = await obsRepo.create({
      profileId,
      theme: 'Knie',
      fact: 'mine fact',
      pattern: '',
      selfRegulation: '',
      status: 'Stabil',
      source: 'user',
      extraSections: {},
    });
    await expect(() =>
      importProfile(
        emptyParseResult({ observations: [obs('Knie', 'theirs fact')] }),
        profileId,
        { replaceExisting: { observations: 'merge' } },
        // no resolutions provided
      ),
    ).rejects.toThrow(UnresolvedConflictError);

    // W1 atomicity: existing row stays at 'mine fact' (transaction
    // never opened because the throw happened in prepareMergeRows
    // before the db.transaction call).
    const stored = await obsRepo.listByProfile(profileId);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.fact).toBe('mine fact');
    expect(stored[0]?.id).toBe(existingEntity.id);
  });

  it('merge alongside replace + skip honours the per-type pick', async () => {
    const obsRepo = new ObservationRepository();
    const supplementRepo = new SupplementRepository();
    const openPointRepo = new OpenPointRepository();
    await obsRepo.create({
      profileId,
      theme: 'Existing-obs',
      fact: 'kept',
      pattern: '',
      selfRegulation: '',
      status: 'Stabil',
      source: 'user',
      extraSections: {},
    });
    await supplementRepo.create({
      profileId,
      name: 'Existing-Supp',
      category: 'daily',
    });
    await openPointRepo.create({
      profileId,
      text: 'Existing-OP',
      context: 'Arzt',
      resolved: false,
    });

    await importProfile(
      emptyParseResult({
        observations: [obs('New-obs')],
        supplements: [{ name: 'Imported-Supp', category: 'daily' }],
        openPoints: [{ text: 'Imported-OP', context: 'Neu', resolved: false }],
      }),
      profileId,
      {
        replaceExisting: {
          observations: 'merge',
          supplements: 'replace',
          openPoints: 'skip',
        },
      },
    );

    // observations: merge -> Existing-obs preserved + New-obs added.
    const obsStored = await obsRepo.listByProfile(profileId);
    expect(obsStored.map((o) => o.theme).sort()).toEqual(['Existing-obs', 'New-obs']);

    // supplements: replace -> only Imported-Supp.
    const supStored = await supplementRepo.listByProfile(profileId);
    expect(supStored.map((s) => s.name)).toEqual(['Imported-Supp']);

    // openPoints: skip -> only Existing-OP, imported dropped.
    const opStored = await openPointRepo.listByProfile(profileId);
    expect(opStored.map((p) => p.text)).toEqual(['Existing-OP']);
  });

  it('merge mode covers supplements: same name+brand identical = no-op', async () => {
    const supplementRepo = new SupplementRepository();
    await supplementRepo.create({
      profileId,
      name: 'Vitamin D3',
      brand: 'Pure',
      category: 'daily',
    });
    await importProfile(
      emptyParseResult({
        supplements: [
          { name: 'Vitamin D3', brand: 'Pure', category: 'daily' },
          { name: 'Magnesium', category: 'daily' },
        ],
      }),
      profileId,
      { replaceExisting: { supplements: 'merge' } },
    );
    const stored = await supplementRepo.listByProfile(profileId);
    expect(stored).toHaveLength(2);
    expect(stored.map((s) => s.name).sort()).toEqual(['Magnesium', 'Vitamin D3']);
  });

  it('merge mode covers open-points: same context+text identical = no-op (composite key)', async () => {
    const openPointRepo = new OpenPointRepository();
    await openPointRepo.create({
      profileId,
      text: 'Wasser trinken',
      context: 'Blutabnahme',
      resolved: false,
    });
    await importProfile(
      emptyParseResult({
        openPoints: [
          { text: 'Wasser trinken', context: 'Blutabnahme', resolved: false },
          { text: 'Supplemente pausieren', context: 'Blutabnahme', resolved: false },
        ],
      }),
      profileId,
      { replaceExisting: { openPoints: 'merge' } },
    );
    const stored = await openPointRepo.listByProfile(profileId);
    expect(stored).toHaveLength(2);
    expect(stored.map((p) => p.text).sort()).toEqual(['Supplemente pausieren', 'Wasser trinken']);
  });

  it('merge mode covers profile-versions and still appends synthesized marker', async () => {
    const profileVersionRepo = new ProfileVersionRepository();
    await profileVersionRepo.create({
      profileId,
      version: '1.0',
      changeDescription: 'Existing',
      changeDate: '2025-01-01',
    });
    await importProfile(
      emptyParseResult({
        profileVersions: [
          { version: '2.0', changeDescription: 'New row', changeDate: '2026-04-01' },
        ],
      }),
      profileId,
      { replaceExisting: { profileVersions: 'merge' } },
    );
    const stored = await profileVersionRepo.listByProfile(profileId);
    // Existing 1.0 + parsed 2.0 + synthesized marker = 3.
    const versions = stored.map((v) => v.version).sort();
    expect(versions).toContain('1.0');
    expect(versions).toContain('2.0');
    // Synthesized marker has a bumped version (2.1 in this case).
    const descriptions = stored.map((v) => v.changeDescription);
    expect(descriptions).toContain('Profil aus Datei importiert');
    expect(descriptions).toContain('Existing');
    expect(descriptions).toContain('New row');
    expect(stored).toHaveLength(3);
  });

  it('merge mode covers timeline entries (composite period|title key)', async () => {
    const timelineRepo = new TimelineEntryRepository();
    await timelineRepo.create({
      profileId,
      period: 'März 2026',
      title: 'Schulter',
      content: 'old',
      source: 'user',
    });
    await importProfile(
      emptyParseResult({
        timelineEntries: [
          {
            period: 'März 2026',
            title: 'Schulter',
            content: 'old',
            source: 'user',
          },
          {
            period: 'März 2026',
            title: 'Knie',
            content: 'new entry',
            source: 'user',
          },
        ],
      }),
      profileId,
      { replaceExisting: { timelineEntries: 'merge' } },
    );
    const stored = await timelineRepo.listByProfile(profileId);
    // Existing Schulter (identical, no-op) + new Knie = 2 rows total.
    expect(stored).toHaveLength(2);
    expect(stored.map((t) => t.title).sort()).toEqual(['Knie', 'Schulter']);
  });

  it("legacy 'add' mode still works (back-compat with IM-05 Option B)", async () => {
    const obsRepo = new ObservationRepository();
    await obsRepo.create({
      profileId,
      theme: 'Knie',
      fact: 'A',
      pattern: '',
      selfRegulation: '',
      status: 'Stabil',
      source: 'user',
      extraSections: {},
    });
    // 'add' mode should still produce two rows (duplicate by design).
    await importProfile(emptyParseResult({ observations: [obs('Knie', 'B')] }), profileId, {
      replaceExisting: { observations: 'add' },
    });
    const stored = await obsRepo.listByProfile(profileId);
    expect(stored).toHaveLength(2);
  });
});
