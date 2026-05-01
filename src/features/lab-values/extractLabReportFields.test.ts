import { describe, it, expect } from 'vitest';
import { extractLabReportFields } from './extractLabReportFields';
import type { LabReportWithValues } from './useLabValues';

function report(
  overrides: Partial<LabReportWithValues['report']> & { id: string },
  values: Map<
    string,
    LabReportWithValues['valuesByCategory'] extends Map<string, infer V> ? V : never
  > = new Map(),
): LabReportWithValues {
  const { id, ...rest } = overrides;
  return {
    report: {
      id,
      profileId: 'p1',
      createdAt: 1,
      updatedAt: 1,
      reportDate: '2026-01-01',
      categoryAssessments: {},
      ...rest,
    },
    valuesByCategory: values,
  };
}

describe('extractLabReportFields', () => {
  it('returns empty array for no reports', () => {
    expect(extractLabReportFields([])).toEqual([]);
  });

  it('emits header meta fields only when present', () => {
    const r = report({ id: 'a', labName: 'Synlab', doctorName: '', reportNumber: '' });
    const fields = extractLabReportFields([r]);
    expect(fields.map((f) => f.key)).toEqual(['a:labName']);
    expect(fields[0]?.text).toBe('Synlab');
  });

  it('skips contextNote when blank or whitespace-only', () => {
    const a = report({ id: 'a', contextNote: '   ' });
    const b = report({ id: 'b', contextNote: 'real note' });
    const fields = extractLabReportFields([a, b]);
    expect(fields.find((f) => f.key === 'a:contextNote')).toBeUndefined();
    expect(fields.find((f) => f.key === 'b:contextNote')?.text).toBe('real note');
  });

  it('emits fields in render order: header, context, per category (heading, values, assessment), overall, relevance', () => {
    const values = new Map([
      [
        'Nieren',
        [
          {
            id: 'v1',
            profileId: 'p1',
            reportId: 'a',
            createdAt: 1,
            updatedAt: 1,
            category: 'Nieren',
            parameter: 'Kreatinin',
            result: '1.0',
            unit: 'mg/dl',
            referenceRange: '0.7-1.3',
            assessment: 'normal',
          },
        ],
      ],
    ]);
    const r = report(
      {
        id: 'a',
        labName: 'Synlab',
        doctorName: 'Dr. Mueller',
        reportNumber: 'R-1',
        contextNote: 'context',
        categoryAssessments: { Nieren: 'gut' },
        overallAssessment: 'OK',
        relevanceNotes: 'siehe Notiz',
      },
      values,
    );
    const keys = extractLabReportFields([r]).map((f) => f.key);
    expect(keys).toEqual([
      'a:labName',
      'a:doctorName',
      'a:reportNumber',
      'a:contextNote',
      'a:cat:Nieren:heading',
      'a:val:v1:parameter',
      'a:val:v1:result',
      'a:val:v1:unit',
      'a:val:v1:reference',
      'a:val:v1:assessment',
      'a:cat:Nieren:assessment',
      'a:overall',
      'a:relevance',
    ]);
  });

  it('omits optional value fields when undefined', () => {
    const values = new Map([
      [
        'Nieren',
        [
          {
            id: 'v1',
            profileId: 'p1',
            reportId: 'a',
            createdAt: 1,
            updatedAt: 1,
            category: 'Nieren',
            parameter: 'Kreatinin',
            result: '1.0',
          },
        ],
      ],
    ]);
    const r = report({ id: 'a' }, values);
    const keys = extractLabReportFields([r]).map((f) => f.key);
    expect(keys).toContain('a:val:v1:parameter');
    expect(keys).toContain('a:val:v1:result');
    expect(keys).not.toContain('a:val:v1:unit');
    expect(keys).not.toContain('a:val:v1:reference');
    expect(keys).not.toContain('a:val:v1:assessment');
  });

  it('preserves report iteration order across multiple reports', () => {
    const a = report({ id: 'a', labName: 'A' });
    const b = report({ id: 'b', labName: 'B' });
    const fields = extractLabReportFields([a, b]);
    expect(fields.map((f) => f.key)).toEqual(['a:labName', 'b:labName']);
  });

  it('emits a field per category and skips empty categoryAssessments', () => {
    const values = new Map([
      [
        'Nieren',
        [
          {
            id: 'v1',
            profileId: 'p1',
            reportId: 'a',
            createdAt: 1,
            updatedAt: 1,
            category: 'Nieren',
            parameter: 'Kreatinin',
            result: '1.0',
          },
        ],
      ],
      [
        'Schilddruese',
        [
          {
            id: 'v2',
            profileId: 'p1',
            reportId: 'a',
            createdAt: 2,
            updatedAt: 2,
            category: 'Schilddruese',
            parameter: 'TSH',
            result: '2.4',
          },
        ],
      ],
    ]);
    const r = report(
      {
        id: 'a',
        categoryAssessments: { Nieren: 'gut', Schilddruese: '' },
      },
      values,
    );
    const keys = extractLabReportFields([r]).map((f) => f.key);
    expect(keys).toContain('a:cat:Nieren:heading');
    expect(keys).toContain('a:cat:Nieren:assessment');
    expect(keys).toContain('a:cat:Schilddruese:heading');
    expect(keys).not.toContain('a:cat:Schilddruese:assessment');
  });
});
