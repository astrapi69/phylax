import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, act } from '@testing-library/react';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import { LabReportRepository, LabValueRepository, ProfileRepository } from '../../db/repositories';
import type { LabReport, LabValue } from '../../domain';
import { useLabValueForm } from './useLabValueForm';

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

describe('useLabValueForm', () => {
  it('starts in closed state', () => {
    const { result } = renderHook(() => useLabValueForm());
    expect(result.current.state.kind).toBe('closed');
  });

  it('openCreate seeds blank fields and binds the parent reportId', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);

    const { result } = renderHook(() => useLabValueForm());
    await act(async () => {
      await result.current.openCreate(report.id);
    });

    expect(result.current.state.kind).toBe('open');
    if (result.current.state.kind !== 'open') return;
    expect(result.current.state.mode.kind).toBe('create');
    if (result.current.state.mode.kind === 'create') {
      expect(result.current.state.mode.reportId).toBe(report.id);
    }
    expect(result.current.state.fields.category).toBe('');
    expect(result.current.state.fields.parameter).toBe('');
    expect(result.current.state.fields.result).toBe('');
  });

  it('openCreate populates parameters datalist with German collation', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);
    await makeValue(profileId, report.id, { parameter: 'TSH' });
    await makeValue(profileId, report.id, { parameter: 'Älbumin' });
    await makeValue(profileId, report.id, { parameter: 'Kreatinin' });

    const { result } = renderHook(() => useLabValueForm());
    await act(async () => {
      await result.current.openCreate(report.id);
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    // German collator orders Ä between A and B; verify Ä first, then K, then T.
    expect(result.current.state.parameters[0]).toBe('Älbumin');
    expect(result.current.state.parameters).toContain('Kreatinin');
    expect(result.current.state.parameters).toContain('TSH');
  });

  it('openCreate scopes categories datalist to the active report', async () => {
    const profileId = await ensureProfile();
    const reportA = await makeReport(profileId, { reportDate: '2026-01-01' });
    const reportB = await makeReport(profileId, { reportDate: '2026-02-01' });
    await makeValue(profileId, reportA.id, { category: 'Blutbild', parameter: 'Hb' });
    await makeValue(profileId, reportA.id, { category: 'Nierenwerte', parameter: 'Krea' });
    await makeValue(profileId, reportB.id, { category: 'Lipide', parameter: 'LDL' });

    const { result } = renderHook(() => useLabValueForm());
    await act(async () => {
      await result.current.openCreate(reportA.id);
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect([...result.current.state.categories]).toEqual(['Blutbild', 'Nierenwerte']);
  });

  it('openEdit prefills from value and refreshes datalists', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);
    const value = await makeValue(profileId, report.id, {
      category: 'Stoffwechsel',
      parameter: 'Glukose',
      result: '95',
      unit: 'mg/dl',
      referenceRange: '70-99',
      assessment: 'normal',
    });

    const { result } = renderHook(() => useLabValueForm());
    await act(async () => {
      await result.current.openEdit(value);
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.mode.kind).toBe('edit');
    expect(result.current.state.fields.category).toBe('Stoffwechsel');
    expect(result.current.state.fields.parameter).toBe('Glukose');
    expect(result.current.state.fields.result).toBe('95');
    expect(result.current.state.fields.unit).toBe('mg/dl');
    expect(result.current.state.fields.referenceRange).toBe('70-99');
    expect(result.current.state.fields.assessment).toBe('normal');
    expect(result.current.state.categories).toContain('Stoffwechsel');
  });

  it('setField mutates the corresponding field', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);

    const { result } = renderHook(() => useLabValueForm());
    await act(async () => {
      await result.current.openCreate(report.id);
    });
    act(() => {
      result.current.setField('category', 'Blutbild');
      result.current.setField('parameter', 'Hämoglobin');
      result.current.setField('result', '14.2');
      result.current.setField('unit', 'g/dl');
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.fields.category).toBe('Blutbild');
    expect(result.current.state.fields.parameter).toBe('Hämoglobin');
    expect(result.current.state.fields.result).toBe('14.2');
    expect(result.current.state.fields.unit).toBe('g/dl');
  });

  it('submit gated when category is empty (no write, modal stays open)', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);

    const { result } = renderHook(() => useLabValueForm());
    await act(async () => {
      await result.current.openCreate(report.id);
    });
    act(() => {
      result.current.setField('parameter', 'Hb');
      result.current.setField('result', '14.2');
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.state.kind).toBe('open');
    const values = await new LabValueRepository().listByReport(report.id);
    expect(values).toHaveLength(0);
  });

  it('submit gated when parameter is empty', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);

    const { result } = renderHook(() => useLabValueForm());
    await act(async () => {
      await result.current.openCreate(report.id);
    });
    act(() => {
      result.current.setField('category', 'Blutbild');
      result.current.setField('result', '14.2');
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.state.kind).toBe('open');
    const values = await new LabValueRepository().listByReport(report.id);
    expect(values).toHaveLength(0);
  });

  it('submit gated when result is empty', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);

    const { result } = renderHook(() => useLabValueForm());
    await act(async () => {
      await result.current.openCreate(report.id);
    });
    act(() => {
      result.current.setField('category', 'Blutbild');
      result.current.setField('parameter', 'Hb');
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(result.current.state.kind).toBe('open');
    const values = await new LabValueRepository().listByReport(report.id);
    expect(values).toHaveLength(0);
  });

  it('submit-create writes a new value with empty optional fields coerced to undefined', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);

    let committed = false;
    const { result } = renderHook(() =>
      useLabValueForm({
        onCommitted: () => {
          committed = true;
        },
      }),
    );
    await act(async () => {
      await result.current.openCreate(report.id);
    });
    act(() => {
      result.current.setField('category', 'Blutbild');
      result.current.setField('parameter', 'Leukozyten');
      result.current.setField('result', '6.04');
      result.current.setField('unit', '   '); // whitespace -> undefined
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(committed).toBe(true);
    expect(result.current.state.kind).toBe('closed');

    const values = await new LabValueRepository().listByReport(report.id);
    expect(values).toHaveLength(1);
    expect(values[0]?.category).toBe('Blutbild');
    expect(values[0]?.parameter).toBe('Leukozyten');
    expect(values[0]?.result).toBe('6.04');
    expect(values[0]?.unit).toBeUndefined();
    expect(values[0]?.referenceRange).toBeUndefined();
    expect(values[0]?.assessment).toBeUndefined();
    expect(values[0]?.reportId).toBe(report.id);
  });

  it('submit-edit preserves sourceDocumentId verbatim (provenance round-trip guard)', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);
    const value = await makeValue(profileId, report.id, {
      parameter: 'TSH',
      result: '2.1',
      sourceDocumentId: 'doc-from-import',
    });

    const { result } = renderHook(() => useLabValueForm());
    await act(async () => {
      await result.current.openEdit(value);
    });
    act(() => {
      result.current.setField('result', '2.5');
    });
    await act(async () => {
      await result.current.submit();
    });

    const updated = await new LabValueRepository().getById(value.id);
    expect(updated?.result).toBe('2.5');
    expect(updated?.sourceDocumentId).toBe('doc-from-import');
    expect(updated?.reportId).toBe(report.id); // FK preserved
    expect(updated?.profileId).toBe(profileId);
  });

  it('submit-edit allows re-categorization (table re-groups via refetch)', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);
    const value = await makeValue(profileId, report.id, {
      category: 'Blutbild',
      parameter: 'Glukose',
      result: '95',
    });

    const { result } = renderHook(() => useLabValueForm());
    await act(async () => {
      await result.current.openEdit(value);
    });
    act(() => {
      result.current.setField('category', 'Stoffwechsel');
    });
    await act(async () => {
      await result.current.submit();
    });

    const updated = await new LabValueRepository().getById(value.id);
    expect(updated?.category).toBe('Stoffwechsel');

    const valuesInBlutbild = (await new LabValueRepository().listByReport(report.id)).filter(
      (v) => v.category === 'Blutbild',
    );
    expect(valuesInBlutbild).toHaveLength(0);
  });

  it('openCreate works on auto-synthesized reports without labName (IMP-04 parity)', async () => {
    const profileId = await ensureProfile();
    // IMP-04 fallback: today-date, no labName.
    const synthesized = await makeReport(profileId, {
      reportDate: new Date().toISOString().slice(0, 10),
      labName: undefined,
    });

    const { result } = renderHook(() => useLabValueForm());
    await act(async () => {
      await result.current.openCreate(synthesized.id);
    });
    act(() => {
      result.current.setField('category', 'Vitamine');
      result.current.setField('parameter', 'Vitamin D');
      result.current.setField('result', '32');
      result.current.setField('unit', 'ng/ml');
    });
    await act(async () => {
      await result.current.submit();
    });

    const values = await new LabValueRepository().listByReport(synthesized.id);
    expect(values).toHaveLength(1);
    expect(values[0]?.parameter).toBe('Vitamin D');
    expect(values[0]?.reportId).toBe(synthesized.id);
  });

  it('openDelete + confirmDelete removes only the target value, leaves siblings intact', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);
    const target = await makeValue(profileId, report.id, { parameter: 'TSH' });
    await makeValue(profileId, report.id, { parameter: 'fT3' });
    await makeValue(profileId, report.id, { parameter: 'fT4' });

    let committed = false;
    const { result } = renderHook(() =>
      useLabValueForm({
        onCommitted: () => {
          committed = true;
        },
      }),
    );
    act(() => {
      result.current.openDelete(target);
    });
    await act(async () => {
      await result.current.confirmDelete();
    });
    expect(committed).toBe(true);
    expect(result.current.state.kind).toBe('closed');

    const remaining = await new LabValueRepository().listByReport(report.id);
    expect(remaining).toHaveLength(2);
    expect(remaining.map((v) => v.parameter).sort()).toEqual(['fT3', 'fT4']);
  });

  it('close resets state to closed', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);
    const { result } = renderHook(() => useLabValueForm());
    await act(async () => {
      await result.current.openCreate(report.id);
    });
    act(() => result.current.close());
    expect(result.current.state.kind).toBe('closed');
  });

  it('submit error keeps modal open and surfaces detail', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);
    const valueRepo = new LabValueRepository();
    valueRepo.create = async () => {
      throw new Error('quota exceeded');
    };
    const { result } = renderHook(() => useLabValueForm({ repos: { labValue: valueRepo } }));
    await act(async () => {
      await result.current.openCreate(report.id);
    });
    act(() => {
      result.current.setField('category', 'X');
      result.current.setField('parameter', 'Y');
      result.current.setField('result', 'Z');
    });
    await act(async () => {
      await result.current.submit();
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.error).toContain('quota exceeded');
    expect(result.current.state.submitting).toBe(false);
  });

  it('confirmDelete error keeps modal open with delete error', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);
    const value = await makeValue(profileId, report.id);
    const valueRepo = new LabValueRepository();
    valueRepo.delete = async () => {
      throw new Error('crypto failure');
    };
    const { result } = renderHook(() => useLabValueForm({ repos: { labValue: valueRepo } }));
    act(() => {
      result.current.openDelete(value);
    });
    await act(async () => {
      await result.current.confirmDelete();
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.error).toContain('crypto failure');
  });

  it('opening create after close shows blank fields (per-open isolation)', async () => {
    const profileId = await ensureProfile();
    const report = await makeReport(profileId);
    const { result } = renderHook(() => useLabValueForm());
    await act(async () => {
      await result.current.openCreate(report.id);
    });
    act(() => {
      result.current.setField('category', 'Temp');
      result.current.setField('parameter', 'Tmp');
    });
    act(() => result.current.close());
    await act(async () => {
      await result.current.openCreate(report.id);
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect(result.current.state.fields.category).toBe('');
    expect(result.current.state.fields.parameter).toBe('');
  });

  it('listParameters dedupes across reports', async () => {
    const profileId = await ensureProfile();
    const reportA = await makeReport(profileId, { reportDate: '2026-01-01' });
    const reportB = await makeReport(profileId, { reportDate: '2026-02-01' });
    await makeValue(profileId, reportA.id, { parameter: 'TSH' });
    await makeValue(profileId, reportB.id, { parameter: 'TSH' });
    await makeValue(profileId, reportB.id, { parameter: 'Hb' });

    const { result } = renderHook(() => useLabValueForm());
    await act(async () => {
      await result.current.openCreate(reportA.id);
    });
    if (result.current.state.kind !== 'open') throw new Error('expected open');
    expect([...result.current.state.parameters]).toEqual(['Hb', 'TSH']);
  });
});
