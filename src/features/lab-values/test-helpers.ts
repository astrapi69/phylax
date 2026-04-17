import type { LabReport, LabValue } from '../../domain';

export function makeLabReport(overrides: Partial<LabReport> = {}): LabReport {
  return {
    id: 'lr1',
    profileId: 'p1',
    createdAt: 1,
    updatedAt: 1,
    reportDate: '2026-02-27',
    categoryAssessments: {},
    ...overrides,
  };
}

export function makeLabValue(overrides: Partial<LabValue> = {}): LabValue {
  return {
    id: 'lv1',
    profileId: 'p1',
    createdAt: 1,
    updatedAt: 1,
    reportId: 'lr1',
    category: 'Blutbild',
    parameter: 'Leukozyten',
    result: '6,04',
    ...overrides,
  };
}
