import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { LabReportRepository, LabValueRepository, ProfileRepository } from '../../db/repositories';
import type { Profile } from '../../domain';
import { useLabValues } from './useLabValues';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession() {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function createProfile(): Promise<Profile> {
  const repo = new ProfileRepository();
  return repo.create({
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
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
});

describe('useLabValues', () => {
  it('initial state is loading', () => {
    const { result } = renderHook(() => useLabValues());
    expect(result.current.state.kind).toBe('loading');
  });

  it('loads reports with values grouped by category', async () => {
    const profile = await createProfile();
    const valueRepo = new LabValueRepository();
    const reportRepo = new LabReportRepository(valueRepo);
    const report = await reportRepo.create({
      profileId: profile.id,
      reportDate: '2026-02-27',
      categoryAssessments: {},
    });
    await valueRepo.create({
      profileId: profile.id,
      reportId: report.id,
      category: 'Blutbild',
      parameter: 'Hb',
      result: '14.2',
    });
    await valueRepo.create({
      profileId: profile.id,
      reportId: report.id,
      category: 'Nierenwerte',
      parameter: 'Kreatinin',
      result: '0.95',
    });

    const { result } = renderHook(() => useLabValues());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      expect(result.current.state.reports).toHaveLength(1);
      const { valuesByCategory } = result.current.state.reports[0] ?? {
        valuesByCategory: new Map(),
      };
      expect(valuesByCategory.has('Blutbild')).toBe(true);
      expect(valuesByCategory.has('Nierenwerte')).toBe(true);
      expect(valuesByCategory.get('Blutbild')).toHaveLength(1);
    }
  });

  it('returns empty array when no reports exist', async () => {
    await createProfile();
    const { result } = renderHook(() => useLabValues());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      expect(result.current.state.reports).toEqual([]);
    }
  });

  it('transitions to error when no profile exists', async () => {
    const { result } = renderHook(() => useLabValues());
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    if (result.current.state.kind === 'error') {
      expect(result.current.state.error.kind).toBe('no-profile');
    }
  });

  it('returns multiple reports in date-descending order', async () => {
    const profile = await createProfile();
    const valueRepo = new LabValueRepository();
    const reportRepo = new LabReportRepository(valueRepo);
    await reportRepo.create({
      profileId: profile.id,
      reportDate: '2024-01-01',
      categoryAssessments: {},
    });
    await reportRepo.create({
      profileId: profile.id,
      reportDate: '2026-06-15',
      categoryAssessments: {},
    });
    await reportRepo.create({
      profileId: profile.id,
      reportDate: '2025-03-10',
      categoryAssessments: {},
    });

    const { result } = renderHook(() => useLabValues());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      const dates = result.current.state.reports.map((r) => r.report.reportDate);
      expect(dates[0]).toBe('2026-06-15');
      expect(dates[2]).toBe('2024-01-01');
    }
  });

  it('refetch reloads after a write without remount', async () => {
    const profile = await createProfile();
    const reportRepo = new LabReportRepository(new LabValueRepository());

    const { result } = renderHook(() => useLabValues());
    await waitFor(() => expect(result.current.state.kind).toBe('loaded'));
    if (result.current.state.kind === 'loaded') {
      expect(result.current.state.reports).toHaveLength(0);
    }

    await reportRepo.create({
      profileId: profile.id,
      reportDate: '2026-04-15',
      categoryAssessments: {},
    });

    act(() => result.current.refetch());

    await waitFor(() => {
      if (result.current.state.kind !== 'loaded') return false;
      return result.current.state.reports.length === 1;
    });
  });

  it('transitions to error when repository throws', async () => {
    await createProfile();
    const spy = vi
      .spyOn(LabReportRepository.prototype, 'listByProfileDateDescending')
      .mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useLabValues());
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    if (result.current.state.kind === 'error' && result.current.state.error.kind === 'generic') {
      expect(result.current.state.error.detail).toBe('boom');
    } else {
      throw new Error('expected generic error');
    }
    spy.mockRestore();
  });
});
