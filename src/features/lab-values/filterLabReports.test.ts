import { describe, it, expect } from 'vitest';
import type { LabReport, LabValue } from '../../domain';
import type { LabReportWithValues } from './useLabValues';
import { filterLabReports } from './filterLabReports';

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

function rwv(report: LabReport, values: LabValue[]): LabReportWithValues {
  const map = new Map<string, LabValue[]>();
  for (const v of values) {
    const list = map.get(v.category) ?? [];
    list.push(v);
    map.set(v.category, list);
  }
  return { report, valuesByCategory: map };
}

describe('filterLabReports', () => {
  it('passes through unchanged when no filter is active', () => {
    const input = [rwv(makeReport(), [makeValue()])];
    const result = filterLabReports(input);
    expect(result.reports).toBe(input);
    expect(result.matchCount).toBe(1);
    expect(result.totalCount).toBe(1);
  });

  it('filters by date range alone', () => {
    const input = [
      rwv(makeReport({ id: 'r-old', reportDate: '2020-01-15' }), [makeValue({ reportId: 'r-old' })]),
      rwv(makeReport({ id: 'r-new', reportDate: '2026-04-15' }), [makeValue({ reportId: 'r-new' })]),
    ];
    const result = filterLabReports(input, {
      dateRange: { from: '2025-01-01' },
    });
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]?.report.id).toBe('r-new');
  });

  it('row-keeps a report when match is in a header field only', () => {
    const input = [
      rwv(makeReport({ labName: 'Synlab' }), [
        makeValue({ parameter: 'TSH' }),
        makeValue({ id: 'v2', parameter: 'fT3' }),
      ]),
    ];
    const result = filterLabReports(input, { query: 'synlab' });
    expect(result.reports).toHaveLength(1);
    // All values still present (Q10 row-keep).
    const first = result.reports[0];
    if (!first) throw new Error('expected at least one report');
    const allValues = Array.from(first.valuesByCategory.values()).flat();
    expect(allValues).toHaveLength(2);
  });

  it('row-keeps a report when match is in a single child value', () => {
    const input = [
      rwv(makeReport(), [
        makeValue({ parameter: 'Kreatinin' }),
        makeValue({ id: 'v2', parameter: 'TSH' }),
        makeValue({ id: 'v3', parameter: 'Hb' }),
      ]),
    ];
    const result = filterLabReports(input, { query: 'Kreatinin' });
    expect(result.reports).toHaveLength(1);
    // All three values present, not just the Kreatinin one.
    const first = result.reports[0];
    if (!first) throw new Error('expected at least one report');
    const allValues = Array.from(first.valuesByCategory.values()).flat();
    expect(allValues).toHaveLength(3);
    expect(allValues.map((v) => v.parameter).sort()).toEqual(['Hb', 'Kreatinin', 'TSH']);
  });

  it('hides reports with no match anywhere', () => {
    const input = [
      rwv(makeReport({ id: 'r1', labName: 'Synlab' }), [makeValue({ parameter: 'TSH' })]),
      rwv(makeReport({ id: 'r2', labName: 'Other' }), [makeValue({ parameter: 'Hb' })]),
    ];
    const result = filterLabReports(input, { query: 'kreatinin' });
    expect(result.reports).toHaveLength(0);
    expect(result.matchCount).toBe(0);
    expect(result.totalCount).toBe(2);
  });

  it('combined search + date applies AND', () => {
    const input = [
      rwv(makeReport({ id: 'r-old', reportDate: '2020-01-15', labName: 'Synlab' }), [
        makeValue({ reportId: 'r-old' }),
      ]),
      rwv(makeReport({ id: 'r-new', reportDate: '2026-04-15', labName: 'Synlab' }), [
        makeValue({ reportId: 'r-new' }),
      ]),
      rwv(makeReport({ id: 'r-new-other', reportDate: '2026-05-01', labName: 'Other' }), [
        makeValue({ reportId: 'r-new-other' }),
      ]),
    ];
    const result = filterLabReports(input, {
      query: 'synlab',
      dateRange: { from: '2025-01-01' },
    });
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]?.report.id).toBe('r-new');
  });

  it('matches multi-term queries across header + value haystack (AND)', () => {
    const input = [
      rwv(makeReport({ labName: 'Synlab' }), [makeValue({ parameter: 'Kreatinin' })]),
      rwv(makeReport({ id: 'r2', labName: 'Synlab' }), [makeValue({ id: 'v2', parameter: 'TSH' })]),
    ];
    const result = filterLabReports(input, { query: 'synlab Kreatinin' });
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]?.report.id).toBe('r1');
  });

  it('honours German collation via normalizeForSearch (case + diacritics)', () => {
    const input = [rwv(makeReport({ labName: 'Schilddrüse-Speziallabor' }), [makeValue()])];
    const result = filterLabReports(input, { query: 'SCHILDDRUSE' });
    expect(result.reports).toHaveLength(1);
  });

  it('matches against per-category assessments + category names', () => {
    const input = [
      rwv(
        makeReport({
          categoryAssessments: { Nierenwerte: 'leicht erhöht' },
        }),
        [makeValue({ category: 'Nierenwerte', parameter: 'Kreatinin' })],
      ),
    ];
    const byCategoryName = filterLabReports(input, { query: 'Nierenwerte' });
    expect(byCategoryName.reports).toHaveLength(1);
    const byAssessmentText = filterLabReports(input, { query: 'leicht erhöht' });
    expect(byAssessmentText.reports).toHaveLength(1);
  });
});
