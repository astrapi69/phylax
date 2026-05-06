import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { lock, unlock, getLockState } from '../../crypto';
import { db } from '../../db/schema';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding, resetDatabase } from '../../db/test-helpers';
import {
  ProfileRepository,
  ObservationRepository,
  LabValueRepository,
  LabReportRepository,
  SupplementRepository,
  OpenPointRepository,
  ProfileVersionRepository,
  TimelineEntryRepository,
} from '../../db/repositories';
import { useSoftReset } from './useSoftReset';

const TEST_PASSWORD = 'soft-reset-pw-12';

async function unlockSession(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function seedProfile(): Promise<string> {
  const repo = new ProfileRepository();
  const profile = await repo.create({
    baseData: {
      name: 'Test',
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
  return profile.id;
}

async function seedObservation(profileId: string): Promise<void> {
  await new ObservationRepository().create({
    profileId,
    theme: 'Knie',
    fact: 'fact',
    pattern: '',
    selfRegulation: '',
    status: 'Stabil',
    source: 'user',
    extraSections: {},
  });
}

async function seedLabReportPlusValue(profileId: string): Promise<void> {
  const labValueRepo = new LabValueRepository();
  const report = await new LabReportRepository(labValueRepo).create({
    profileId,
    reportDate: '2026-01-01',
    categoryAssessments: {},
  });
  await labValueRepo.create({
    profileId,
    reportId: report.id,
    category: 'Blutbild',
    parameter: 'Hämoglobin',
    result: '14',
  });
}

beforeEach(async () => {
  lock();
  await resetDatabase();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('useSoftReset', () => {
  it('starts in idle state with no result', () => {
    const { result } = renderHook(() => useSoftReset());
    expect(result.current.step).toBe('idle');
    expect(result.current.inProgress).toBe(false);
    expect(result.current.result).toBeNull();
  });

  it('clears every data table while preserving meta', async () => {
    const profileId = await seedProfile();
    await seedObservation(profileId);
    await seedLabReportPlusValue(profileId);
    await new SupplementRepository().create({
      profileId,
      name: 'Vitamin D3',
      category: 'daily',
    });
    await new OpenPointRepository().create({
      profileId,
      text: 'Bluttest',
      context: 'Arzt',
      resolved: false,
    });
    await new ProfileVersionRepository().create({
      profileId,
      version: '1.0',
      changeDescription: 'init',
      changeDate: '2026-01-01',
    });
    await new TimelineEntryRepository().create({
      profileId,
      period: 'Januar 2026',
      title: 'note',
      content: '...',
      source: 'user',
    });

    const metaBefore = await readMeta();
    expect(metaBefore?.salt).toBeDefined();
    expect(metaBefore?.payload).toBeDefined();

    const { result } = renderHook(() => useSoftReset());
    await act(async () => {
      await result.current.softReset();
    });

    expect(result.current.step).toBe('done');
    expect(result.current.result?.fullySucceeded).toBe(true);

    // Every data table empty.
    expect(await db.profiles.count()).toBe(0);
    expect(await db.observations.count()).toBe(0);
    expect(await db.labReports.count()).toBe(0);
    expect(await db.labValues.count()).toBe(0);
    expect(await db.supplements.count()).toBe(0);
    expect(await db.openPoints.count()).toBe(0);
    expect(await db.profileVersions.count()).toBe(0);
    expect(await db.documents.count()).toBe(0);
    expect(await db.documentBlobs.count()).toBe(0);
    expect(await db.timelineEntries.count()).toBe(0);

    // Meta intact: salt + encrypted payload (which carries the
    // onboarding-completed marker plus AI config plus app prefs)
    // both byte-for-byte unchanged.
    const metaAfter = await readMeta();
    expect(metaAfter?.salt).toEqual(metaBefore?.salt);
    expect(metaAfter?.payload).toEqual(metaBefore?.payload);
    expect(metaAfter?.schemaVersion).toBe(metaBefore?.schemaVersion);
  });

  it('keeps the in-memory crypto key (user stays unlocked)', async () => {
    expect(getLockState()).toBe('unlocked');
    const { result } = renderHook(() => useSoftReset());
    await act(async () => {
      await result.current.softReset();
    });
    expect(getLockState()).toBe('unlocked');
  });

  it('wipes profile-scoped phylax.persistence.* localStorage keys', async () => {
    window.localStorage.setItem('phylax.persistence.dismissed.profile-1', '1');
    window.localStorage.setItem('phylax.persistence.dismissed.profile-2', '1');
    window.localStorage.setItem('phylax.persistence.other-suffix', 'keep-or-wipe');

    const { result } = renderHook(() => useSoftReset());
    await act(async () => {
      await result.current.softReset();
    });

    expect(window.localStorage.getItem('phylax.persistence.dismissed.profile-1')).toBeNull();
    expect(window.localStorage.getItem('phylax.persistence.dismissed.profile-2')).toBeNull();
    // The pattern matches anything starting with `phylax.persistence.` so
    // future sub-keys also wipe.
    expect(window.localStorage.getItem('phylax.persistence.other-suffix')).toBeNull();
  });

  it('keeps user-preference and security localStorage keys', async () => {
    window.localStorage.setItem('phylax-language', 'de');
    window.localStorage.setItem('phylax-theme', 'dark');
    window.localStorage.setItem('phylax-observations-sort', 'recent');
    window.localStorage.setItem('phylax-supplements-sort', 'alphabetical');
    window.localStorage.setItem('phylax-ai-disclaimer-accepted', 'true');
    window.localStorage.setItem('phylax-donation-state', 'shown');

    const { result } = renderHook(() => useSoftReset());
    await act(async () => {
      await result.current.softReset();
    });

    expect(window.localStorage.getItem('phylax-language')).toBe('de');
    expect(window.localStorage.getItem('phylax-theme')).toBe('dark');
    expect(window.localStorage.getItem('phylax-observations-sort')).toBe('recent');
    expect(window.localStorage.getItem('phylax-supplements-sort')).toBe('alphabetical');
    expect(window.localStorage.getItem('phylax-ai-disclaimer-accepted')).toBe('true');
    expect(window.localStorage.getItem('phylax-donation-state')).toBe('shown');
  });

  it('keeps sessionStorage rate-limiter keys (security boundary)', async () => {
    window.sessionStorage.setItem('phylax-unlock-rate-limit', '{"failed":3}');
    window.sessionStorage.setItem('phylax-backup-import-rate-limit', '{"failed":1}');

    const { result } = renderHook(() => useSoftReset());
    await act(async () => {
      await result.current.softReset();
    });

    expect(window.sessionStorage.getItem('phylax-unlock-rate-limit')).toBe('{"failed":3}');
    expect(window.sessionStorage.getItem('phylax-backup-import-rate-limit')).toBe('{"failed":1}');
  });

  it('does not touch non-Phylax localStorage keys', async () => {
    window.localStorage.setItem('not-phylax-key', 'preserve');
    window.localStorage.setItem('phylax.persistence.dismissed.x', '1');
    const { result } = renderHook(() => useSoftReset());
    await act(async () => {
      await result.current.softReset();
    });
    expect(window.localStorage.getItem('not-phylax-key')).toBe('preserve');
    expect(window.localStorage.getItem('phylax.persistence.dismissed.x')).toBeNull();
  });

  it('records error in result when the data-clear transaction fails', async () => {
    // Force a transaction failure: spy on db.transaction to reject.
    const txnSpy = vi
      .spyOn(db, 'transaction')
      .mockRejectedValueOnce(new Error('synthetic txn failure') as never);

    const { result } = renderHook(() => useSoftReset());
    await act(async () => {
      await result.current.softReset();
    });

    expect(result.current.result?.fullySucceeded).toBe(false);
    expect(result.current.result?.errors).toEqual([
      { step: 'clearing-data', message: 'synthetic txn failure' },
    ]);

    txnSpy.mockRestore();
  });

  it('inProgress flag flips while running', async () => {
    const { result } = renderHook(() => useSoftReset());
    expect(result.current.inProgress).toBe(false);

    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.softReset();
    });
    // Synchronous state update sets inProgress true.
    await waitFor(() => expect(result.current.inProgress).toBe(true));

    await act(async () => {
      await pending;
    });
    expect(result.current.inProgress).toBe(false);
    expect(result.current.step).toBe('done');
  });
});
