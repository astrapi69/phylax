import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, waitFor } from '@testing-library/react';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { resetDatabase, setupCompletedOnboarding } from '../../db/test-helpers';
import {
  LabValueRepository,
  ObservationRepository,
  ProfileRepository,
} from '../../db/repositories';
import { LabReportRepository } from '../../db/repositories/labReportRepository';
import type { Profile } from '../../domain';
import { useLinkableEntities } from './useLinkableEntities';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function seedProfile(): Promise<Profile> {
  return new ProfileRepository().create({
    baseData: {
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
}

async function seedReport(profileId: string): Promise<string> {
  const report = await new LabReportRepository(new LabValueRepository()).create({
    profileId,
    reportDate: '2026-02-15',
    categoryAssessments: {},
  });
  return report.id;
}

beforeEach(async () => {
  lock();
  await resetDatabase();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLinkableEntities', () => {
  it('initial state is loading', () => {
    const { result } = renderHook(() => useLinkableEntities());
    expect(result.current.kind).toBe('loading');
  });

  it('returns empty arrays when no profile exists', async () => {
    const { result } = renderHook(() => useLinkableEntities());
    await waitFor(() => expect(result.current.kind).toBe('loaded'));
    if (result.current.kind === 'loaded') {
      expect(result.current.observations).toEqual([]);
      expect(result.current.labValues).toEqual([]);
    }
  });

  it('returns observations sorted newest-first with theme + truncated fact label', async () => {
    const profile = await seedProfile();
    const obsRepo = new ObservationRepository();

    await obsRepo.create({
      profileId: profile.id,
      theme: 'Schulter',
      fact: 'Erstes Symptom',
      pattern: '',
      selfRegulation: '',
      status: 'stabil',
      source: 'user',
      extraSections: {},
    });
    await new Promise((r) => setTimeout(r, 5));
    await obsRepo.create({
      profileId: profile.id,
      theme: 'Knie',
      fact: 'Zweites Symptom',
      pattern: '',
      selfRegulation: '',
      status: 'akut',
      source: 'user',
      extraSections: {},
    });

    const { result } = renderHook(() => useLinkableEntities());
    await waitFor(() => expect(result.current.kind).toBe('loaded'));
    if (result.current.kind === 'loaded') {
      expect(result.current.observations.map((o) => o.label)).toEqual([
        'Knie - Zweites Symptom',
        'Schulter - Erstes Symptom',
      ]);
    }
  });

  it('observation label uses ellipsis when fact exceeds 40 chars and trims to first line', async () => {
    const profile = await seedProfile();
    await new ObservationRepository().create({
      profileId: profile.id,
      theme: 'Allgemein',
      fact: 'Ein sehr langer erster Satz, der weit über vierzig Zeichen hinausgeht.\nzweite Zeile',
      pattern: '',
      selfRegulation: '',
      status: 'stabil',
      source: 'user',
      extraSections: {},
    });

    const { result } = renderHook(() => useLinkableEntities());
    await waitFor(() => expect(result.current.kind).toBe('loaded'));
    if (result.current.kind === 'loaded') {
      const label = result.current.observations[0]?.label ?? '';
      expect(label.startsWith('Allgemein - ')).toBe(true);
      // "Allgemein - " (12) + 40 chars including the ellipsis
      expect(label.endsWith('…')).toBe(true);
      expect(label).not.toContain('zweite Zeile');
    }
  });

  it('observation label collapses to theme-only when fact is empty', async () => {
    const profile = await seedProfile();
    await new ObservationRepository().create({
      profileId: profile.id,
      theme: 'Schlaf',
      fact: '',
      pattern: '',
      selfRegulation: '',
      status: 'stabil',
      source: 'user',
      extraSections: {},
    });

    const { result } = renderHook(() => useLinkableEntities());
    await waitFor(() => expect(result.current.kind).toBe('loaded'));
    if (result.current.kind === 'loaded') {
      expect(result.current.observations[0]?.label).toBe('Schlaf');
    }
  });

  it('lab values are sorted newest-first with parameter + result + unit label', async () => {
    const profile = await seedProfile();
    const reportId = await seedReport(profile.id);
    const repo = new LabValueRepository();

    await repo.create({
      profileId: profile.id,
      reportId,
      category: 'Blutbild',
      parameter: 'Leukozyten',
      result: '6,04',
      unit: 'G/l',
    });
    await new Promise((r) => setTimeout(r, 5));
    await repo.create({
      profileId: profile.id,
      reportId,
      category: 'Blutbild',
      parameter: 'Hämoglobin',
      result: '14',
      unit: 'g/dl',
    });

    const { result } = renderHook(() => useLinkableEntities());
    await waitFor(() => expect(result.current.kind).toBe('loaded'));
    if (result.current.kind === 'loaded') {
      expect(result.current.labValues.map((v) => v.label)).toEqual([
        'Hämoglobin - 14 g/dl',
        'Leukozyten - 6,04 G/l',
      ]);
    }
  });

  it('lab value label omits the unit when unit is missing', async () => {
    const profile = await seedProfile();
    const reportId = await seedReport(profile.id);

    await new LabValueRepository().create({
      profileId: profile.id,
      reportId,
      category: 'Sonstiges',
      parameter: 'pH',
      result: '7,4',
    });

    const { result } = renderHook(() => useLinkableEntities());
    await waitFor(() => expect(result.current.kind).toBe('loaded'));
    if (result.current.kind === 'loaded') {
      expect(result.current.labValues[0]?.label).toBe('pH - 7,4');
    }
  });

  it('surfaces an Error message via the error state', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useLinkableEntities());
    await waitFor(() => expect(result.current.kind).toBe('error'));
    if (result.current.kind === 'error') {
      expect(result.current.detail).toBe('boom');
    }
  });

  it('coerces non-Error rejections via String() in the error state', async () => {
    vi.spyOn(ProfileRepository.prototype, 'getCurrentProfile').mockRejectedValue('string-failure');
    const { result } = renderHook(() => useLinkableEntities());
    await waitFor(() => expect(result.current.kind).toBe('error'));
    if (result.current.kind === 'error') {
      expect(result.current.detail).toBe('string-failure');
    }
  });
});
