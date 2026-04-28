import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import type { LabReport, LabValue } from '../../domain';
import { exportLabValuesAsCsv } from './csvExport';

const tFake: TFunction<'export'> = ((key: string) => {
  const map: Record<string, string> = {
    'csv.col.date': 'Datum',
    'csv.col.category': 'Kategorie',
    'csv.col.parameter': 'Parameter',
    'csv.col.result': 'Ergebnis',
    'csv.col.unit': 'Einheit',
    'csv.col.reference': 'Referenz',
    'csv.col.assessment': 'Bewertung',
  };
  return map[key] ?? key;
}) as unknown as TFunction<'export'>;

const tFakeEn: TFunction<'export'> = ((key: string) => {
  const map: Record<string, string> = {
    'csv.col.date': 'Date',
    'csv.col.category': 'Category',
    'csv.col.parameter': 'Parameter',
    'csv.col.result': 'Result',
    'csv.col.unit': 'Unit',
    'csv.col.reference': 'Reference',
    'csv.col.assessment': 'Assessment',
  };
  return map[key] ?? key;
}) as unknown as TFunction<'export'>;

function makeReport(over: Partial<LabReport> = {}): LabReport {
  return {
    id: 'r1',
    profileId: 'p1',
    createdAt: 0,
    updatedAt: 0,
    reportDate: '2026-04-15',
    categoryAssessments: {},
    ...over,
  };
}

function makeValue(over: Partial<LabValue> = {}): LabValue {
  return {
    id: 'v1',
    profileId: 'p1',
    reportId: 'r1',
    createdAt: 0,
    updatedAt: 0,
    category: 'Schilddrüse',
    parameter: 'TSH',
    result: '2.4',
    unit: 'mIU/L',
    referenceRange: '0.4 - 4.0',
    assessment: 'normal',
    ...over,
  };
}

describe('exportLabValuesAsCsv', () => {
  it('starts with the UTF-8 BOM', () => {
    const csv = exportLabValuesAsCsv({
      labReports: [],
      labValues: [],
      t: tFake,
      locale: 'de',
    });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('uses semicolon as separator for German locale', () => {
    const csv = exportLabValuesAsCsv({
      labReports: [makeReport()],
      labValues: [makeValue()],
      t: tFake,
      locale: 'de',
    });
    expect(csv).toContain('Datum;Kategorie;Parameter');
    expect(csv).toContain('2026-04-15;Schilddrüse;TSH');
  });

  it('uses comma as separator for English locale', () => {
    const csv = exportLabValuesAsCsv({
      labReports: [makeReport()],
      labValues: [makeValue()],
      t: tFakeEn,
      locale: 'en',
    });
    expect(csv).toContain('Date,Category,Parameter');
    expect(csv).toContain('2026-04-15,Schilddrüse,TSH');
  });

  it('header-only CSV when there are no lab values', () => {
    const csv = exportLabValuesAsCsv({
      labReports: [],
      labValues: [],
      t: tFake,
      locale: 'de',
    });
    const noBom = csv.slice(1);
    expect(noBom).toBe('Datum;Kategorie;Parameter;Ergebnis;Einheit;Referenz;Bewertung');
  });

  it('emits empty cells for missing optional fields', () => {
    const csv = exportLabValuesAsCsv({
      labReports: [makeReport()],
      labValues: [
        makeValue({
          unit: undefined,
          referenceRange: undefined,
          assessment: undefined,
        }),
      ],
      t: tFake,
      locale: 'de',
    });
    expect(csv).toContain('2026-04-15;Schilddrüse;TSH;2.4;;;');
  });

  it('quotes a reference range that contains the separator', () => {
    const csv = exportLabValuesAsCsv({
      labReports: [makeReport()],
      labValues: [
        makeValue({ referenceRange: '1; 3', assessment: undefined }),
      ],
      t: tFake,
      locale: 'de',
    });
    expect(csv).toContain('"1; 3"');
  });

  it('sorts values newest-first by parent reportDate', () => {
    const csv = exportLabValuesAsCsv({
      labReports: [
        makeReport({ id: 'r-old', reportDate: '2024-01-15' }),
        makeReport({ id: 'r-new', reportDate: '2026-04-15' }),
      ],
      labValues: [
        makeValue({ id: 'v-old', reportId: 'r-old', parameter: 'OLD' }),
        makeValue({ id: 'v-new', reportId: 'r-new', parameter: 'NEW' }),
      ],
      t: tFake,
      locale: 'de',
    });
    const lines = csv.slice(1).split('\r\n');
    expect(lines[1]).toContain('NEW');
    expect(lines[2]).toContain('OLD');
  });

  it('honors the date range filter on parent reports', () => {
    const csv = exportLabValuesAsCsv({
      labReports: [
        makeReport({ id: 'r-old', reportDate: '2020-01-15' }),
        makeReport({ id: 'r-new', reportDate: '2026-04-15' }),
      ],
      labValues: [
        makeValue({ id: 'v-old', reportId: 'r-old', parameter: 'OLD' }),
        makeValue({ id: 'v-new', reportId: 'r-new', parameter: 'NEW' }),
      ],
      t: tFake,
      locale: 'de',
      options: { dateRange: { from: new Date('2025-01-01T00:00:00Z') } },
    });
    expect(csv).toContain('NEW');
    expect(csv).not.toContain('OLD');
  });

  it('skips orphan lab values whose reportId does not resolve', () => {
    const csv = exportLabValuesAsCsv({
      labReports: [makeReport()],
      labValues: [
        makeValue({ id: 'v-ok', reportId: 'r1', parameter: 'OK' }),
        makeValue({ id: 'v-orphan', reportId: 'r-missing', parameter: 'ORPHAN' }),
      ],
      t: tFake,
      locale: 'de',
    });
    expect(csv).toContain('OK');
    expect(csv).not.toContain('ORPHAN');
  });

  it('preserves stored assessment values verbatim', () => {
    const csv = exportLabValuesAsCsv({
      labReports: [makeReport()],
      labValues: [makeValue({ assessment: 'erhöht' })],
      t: tFake,
      locale: 'de',
    });
    expect(csv).toContain(';erhöht');
  });
});
