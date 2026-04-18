import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { readMeta } from '../../db/meta';
import { ProfileRepository, ObservationRepository } from '../../db/repositories';
import { useExportData, type LoadExportDataResult } from './useExportData';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function runLoad(): Promise<LoadExportDataResult> {
  const { result } = renderHook(() => useExportData());
  let res: LoadExportDataResult | undefined;
  await act(async () => {
    res = await result.current.loadExportData();
  });
  if (!res) throw new Error('loadExportData did not resolve');
  return res;
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
});

describe('useExportData', () => {
  it('returns ok with all entity lists when a profile exists', async () => {
    const repo = new ProfileRepository();
    const profile = await repo.create({
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
      version: '1.0',
    });
    await new ObservationRepository().create({
      profileId: profile.id,
      theme: 'Schulter',
      fact: 'f',
      pattern: 'p',
      selfRegulation: 's',
      status: 'ok',
      source: 'user',
      extraSections: {},
    });

    const res = await runLoad();
    expect(res.kind).toBe('ok');
    if (res.kind === 'ok') {
      expect(res.data.profile.id).toBe(profile.id);
      expect(res.data.observations).toHaveLength(1);
      expect(res.data.labReports).toHaveLength(0);
      expect(res.data.supplements).toHaveLength(0);
      expect(res.data.openPoints).toHaveLength(0);
      expect(res.data.timelineEntries).toHaveLength(0);
    }
  });

  it('returns no-profile when the database has no profile yet', async () => {
    const res = await runLoad();
    expect(res.kind).toBe('no-profile');
  });

  it('returns locked when the key store is locked during load', async () => {
    await new ProfileRepository().create({
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
      version: '1.0',
    });
    lock();

    const res = await runLoad();
    expect(res.kind).toBe('locked');
  });
});
