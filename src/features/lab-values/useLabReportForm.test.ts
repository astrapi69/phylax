import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, act } from '@testing-library/react';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { LabReportRepository, LabValueRepository, ProfileRepository } from '../../db/repositories';
import type { LabReport, LabValue } from '../../domain';
import { useLabReportForm } from './useLabReportForm';

const TEST_PASSWORD = 'test-password-12';

async function unlockCurrent(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function ensureProfile(): Promise<string> {
  const repo = new ProfileRepository();
  const existing = await repo.getCurrentProfile();
  if (existing) return existing.id;
  const created = await repo.create({
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
  return created.id;
}

async function makeReport(
  profileId: string,
  overrides: Partial<LabReport> = {},
): Promise<LabReport> {
  return new LabReportRepository(new LabValueRepository()).create({
    profileId,
    reportDate: '2026-02-15',
    categoryAssessments: {},
    ...overrides,
  });
}

async function makeValue(
  profileId: string,
  reportId: string,
  overrides: Partial<LabValue> = {},
): Promise<LabValue> {
  return new LabValueRepository().create({
    profileId,
    reportId,
    category: 'Blutbild',
    parameter: 'Leukozyten',
    result: '6,04',
    ...overrides,
  });
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
});

describe('useLabReportForm', () => {
  it('starts in closed state', () => {
    const { result } = renderHook(() => useLabReportForm());
    expect(result.current.state.kind).toBe('closed');
  });

  it('openCreate seeds blank fields with today as reportDate', () => {
    const { result } = renderHook(() => useLabReportForm());
    act(() => {
      result.current.openCreate();
    });

    expect(result.current.state.kind).toBe('open');
    if (result.current.state.kind !== 'open') return;
    expect(result.current.state.mode.kind).toBe('create');
    expect(result.current.state.fields.labName).toBe('');
    expect(result.current.state.fields.reportDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('openEdit prefills from report', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId, {
      reportDate: '2026-03-15',
      labName: 'Synlab',
      doctorName: 'Dr. Mueller',
    });

    const { result } = renderHook(() => useLabReportForm());
    act(() => {
      result.current.openEdit(report);
    });

    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.mode.kind).toBe('edit');
    expect(result.current.state.fields.reportDate).toBe('2026-03-15');
    expect(result.current.state.fields.labName).toBe('Synlab');
    expect(result.current.state.fields.doctorName).toBe('Dr. Mueller');
  });

  it('setField mutates the corresponding field', () => {
    const { result } = renderHook(() => useLabReportForm());
    act(() => {
      result.current.openCreate();
    });
    act(() => {
      result.current.setField('labName', 'Synlab');
      result.current.setField('reportNumber', 'L-12345');
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.fields.labName).toBe('Synlab');
    expect(result.current.state.fields.reportNumber).toBe('L-12345');
  });

  it('submit is gated when reportDate is empty (no write, modal stays open)', async () => {
    const profileId = await ensureProfile();
    const { result } = renderHook(() => useLabReportForm());
    act(() => {
      result.current.openCreate();
    });
    act(() => {
      result.current.setField('reportDate', '');
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.state.kind).toBe('open');
    const reports = await new LabReportRepository(new LabValueRepository()).listByProfile(
      profileId,
    );
    expect(reports).toHaveLength(0);
  });

  it('submit is gated when reportDate is malformed', async () => {
    const profileId = await ensureProfile();
    const { result } = renderHook(() => useLabReportForm());
    act(() => {
      result.current.openCreate();
    });
    act(() => {
      result.current.setField('reportDate', '15.02.2026');
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.state.kind).toBe('open');
    const reports = await new LabReportRepository(new LabValueRepository()).listByProfile(
      profileId,
    );
    expect(reports).toHaveLength(0);
  });

  it('submit is gated when reportDate is a non-existent calendar day (e.g. Feb 31)', async () => {
    const profileId = await ensureProfile();
    const { result } = renderHook(() => useLabReportForm());
    act(() => {
      result.current.openCreate();
    });
    act(() => {
      result.current.setField('reportDate', '2026-02-31');
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.state.kind).toBe('open');
    const reports = await new LabReportRepository(new LabValueRepository()).listByProfile(
      profileId,
    );
    expect(reports).toHaveLength(0);
  });

  it('submit-create writes a new report with empty optional fields coerced to undefined', async () => {
    const profileId = await ensureProfile();
    let committed = false;
    const { result } = renderHook(() =>
      useLabReportForm({
        onCommitted: () => {
          committed = true;
        },
      }),
    );
    act(() => {
      result.current.openCreate();
    });
    act(() => {
      result.current.setField('reportDate', '2026-04-15');
      result.current.setField('labName', 'Synlab');
      result.current.setField('doctorName', '   '); // whitespace -> undefined
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(committed).toBe(true);
    expect(result.current.state.kind).toBe('closed');
    const reports = await new LabReportRepository(new LabValueRepository()).listByProfile(
      profileId,
    );
    expect(reports).toHaveLength(1);
    expect(reports[0]?.reportDate).toBe('2026-04-15');
    expect(reports[0]?.labName).toBe('Synlab');
    expect(reports[0]?.doctorName).toBeUndefined();
    expect(reports[0]?.categoryAssessments).toEqual({});
  });

  it('submit-edit preserves sourceDocumentId + categoryAssessments (Q3 regression guard)', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId, {
      reportDate: '2026-02-15',
      labName: 'Synlab',
      sourceDocumentId: 'doc-from-import',
      categoryAssessments: { Blutbild: 'unauffällig', Nierenwerte: 'leicht erhöht' },
    });

    const { result } = renderHook(() => useLabReportForm());
    act(() => {
      result.current.openEdit(report);
    });
    act(() => {
      result.current.setField('labName', 'Synlab Berlin');
      result.current.setField('reportDate', '2026-02-16');
    });
    await act(async () => {
      await result.current.submit();
    });

    const reportRepo = new LabReportRepository(new LabValueRepository());
    const updated = await reportRepo.getById(report.id);
    expect(updated?.reportDate).toBe('2026-02-16');
    expect(updated?.labName).toBe('Synlab Berlin');
    // Provenance + AI-derived assessments preserved verbatim.
    expect(updated?.sourceDocumentId).toBe('doc-from-import');
    expect(updated?.categoryAssessments).toEqual({
      Blutbild: 'unauffällig',
      Nierenwerte: 'leicht erhöht',
    });
  });

  it('openDelete loads child-value count for the cascade-confirm copy', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);
    await makeValue(profileId, report.id, { parameter: 'Leukozyten' });
    await makeValue(profileId, report.id, { parameter: 'Erythrozyten' });
    await makeValue(profileId, report.id, { parameter: 'Hämoglobin' });

    const { result } = renderHook(() => useLabReportForm());
    await act(async () => {
      await result.current.openDelete(report);
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    if (result.current.state.mode.kind !== 'delete') throw new Error('expected delete mode');
    expect(result.current.state.mode.valueCount).toBe(3);
  });

  it('openDelete + confirmDelete cascades through deleteWithValues', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);
    await makeValue(profileId, report.id);
    await makeValue(profileId, report.id, { parameter: 'Erythrozyten' });

    let committed = false;
    const { result } = renderHook(() =>
      useLabReportForm({
        onCommitted: () => {
          committed = true;
        },
      }),
    );
    await act(async () => {
      await result.current.openDelete(report);
    });
    await act(async () => {
      await result.current.confirmDelete();
    });
    expect(committed).toBe(true);
    expect(result.current.state.kind).toBe('closed');
    const reportRepo = new LabReportRepository(new LabValueRepository());
    const remainingReports = await reportRepo.listByProfile(profileId);
    expect(remainingReports).toHaveLength(0);
    const remainingValues = await new LabValueRepository().listByReport(report.id);
    expect(remainingValues).toHaveLength(0);
  });

  it('close resets state to closed', () => {
    const { result } = renderHook(() => useLabReportForm());
    act(() => {
      result.current.openCreate();
    });
    act(() => result.current.close());
    expect(result.current.state.kind).toBe('closed');
  });

  it('submit error keeps modal open and surfaces detail', async () => {
    await ensureProfile();
    const valueRepo = new LabValueRepository();
    const reportRepo = new LabReportRepository(valueRepo);
    reportRepo.create = async () => {
      throw new Error('quota exceeded');
    };
    const { result } = renderHook(() =>
      useLabReportForm({ repos: { labReport: reportRepo, labValue: valueRepo } }),
    );
    act(() => {
      result.current.openCreate();
    });
    act(() => {
      result.current.setField('reportDate', '2026-04-15');
    });
    await act(async () => {
      await result.current.submit();
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.error).toContain('quota exceeded');
    expect(result.current.state.submitting).toBe(false);
  });

  it('confirmDelete error keeps modal open with cascade error', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);
    const valueRepo = new LabValueRepository();
    const reportRepo = new LabReportRepository(valueRepo);
    reportRepo.deleteWithValues = async () => {
      throw new Error('crypto failure');
    };
    const { result } = renderHook(() =>
      useLabReportForm({ repos: { labReport: reportRepo, labValue: valueRepo } }),
    );
    await act(async () => {
      await result.current.openDelete(report);
    });
    await act(async () => {
      await result.current.confirmDelete();
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.error).toContain('crypto failure');
  });

  it('opening create after close shows blank fields (per-open isolation)', () => {
    const { result } = renderHook(() => useLabReportForm());
    act(() => {
      result.current.openCreate();
    });
    act(() => {
      result.current.setField('labName', 'Temp Lab');
      result.current.setField('reportNumber', 'temp-num');
    });
    act(() => result.current.close());
    act(() => {
      result.current.openCreate();
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.fields.labName).toBe('');
    expect(result.current.state.fields.reportNumber).toBe('');
  });

  it('submit trims optional fields, preserves non-empty strings verbatim', async () => {
    const profileId = await ensureProfile();
    const { result } = renderHook(() => useLabReportForm());
    act(() => {
      result.current.openCreate();
    });
    act(() => {
      result.current.setField('reportDate', '2026-05-01');
      result.current.setField('labName', 'Synlab');
      result.current.setField('contextNote', 'Routinekontrolle');
    });
    await act(async () => {
      await result.current.submit();
    });
    const reports = await new LabReportRepository(new LabValueRepository()).listByProfile(
      profileId,
    );
    expect(reports[0]?.labName).toBe('Synlab');
    expect(reports[0]?.contextNote).toBe('Routinekontrolle');
  });
});
