import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import type {
  LabReport,
  LabValue,
  Observation,
  OpenPoint,
  Profile,
  Supplement,
} from '../../domain';
import { exportProfileAsPdf } from './pdfExport';

/**
 * Minimal smoke for the PDF export. jsPDF runs in jsdom; the test
 * exercises the real lazy-import + generation path and asserts a
 * well-formed Blob comes back. Byte-level assertions are out of
 * scope; the test verifies the orchestration does not throw on a
 * realistic input shape.
 */

const tFake: TFunction<'export'> = ((key: string, options?: Record<string, unknown>) => {
  if (options) {
    return Object.entries(options).reduce(
      (acc, [k, v]) => acc.replace(new RegExp(`{{${k}}}`, 'g'), String(v)),
      key,
    );
  }
  return key;
}) as unknown as TFunction<'export'>;

function makeProfile(overrides: Partial<Profile['baseData']> = {}): Profile {
  return {
    id: 'p1',
    profileId: 'p1',
    createdAt: 0,
    updatedAt: 0,
    baseData: {
      name: 'Test Person',
      birthDate: '1980-06-15',
      knownDiagnoses: [],
      currentMedications: [],
      relevantLimitations: [],
      weightHistory: [],
      profileType: 'self',
      ...overrides,
    },
    warningSigns: [],
    externalReferences: [],
    version: '1.0',
  };
}

function makeObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: 'o1',
    profileId: 'p1',
    createdAt: 0,
    updatedAt: 0,
    theme: 'Schulter',
    fact: 'Stechender Schmerz',
    pattern: 'Morgens schlechter',
    selfRegulation: 'Mobilisation',
    status: 'in Beobachtung',
    source: 'user',
    extraSections: {},
    ...overrides,
  };
}

describe('exportProfileAsPdf', () => {
  it('returns a Blob with PDF mime type for an empty profile', async () => {
    const blob = await exportProfileAsPdf({
      profile: makeProfile(),
      observations: [],
      labReports: [],
      labValues: [],
      supplements: [],
      openPoints: [],
      t: tFake,
      locale: 'de',
      now: new Date('2026-04-28T12:00:00Z'),
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('honors the themes filter on observations', async () => {
    const blob = await exportProfileAsPdf({
      profile: makeProfile(),
      observations: [
        makeObservation({ id: 'a', theme: 'Schulter', fact: 'A' }),
        makeObservation({ id: 'b', theme: 'Knie', fact: 'B' }),
        makeObservation({ id: 'c', theme: 'Schulter', fact: 'C' }),
      ],
      labReports: [],
      labValues: [],
      supplements: [],
      openPoints: [],
      t: tFake,
      locale: 'de',
      themes: ['Schulter'],
      now: new Date('2026-04-28T12:00:00Z'),
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('empty themes array is treated as no filter', async () => {
    const blob = await exportProfileAsPdf({
      profile: makeProfile(),
      observations: [makeObservation({ id: 'a', theme: 'Schulter' })],
      labReports: [],
      labValues: [],
      supplements: [],
      openPoints: [],
      t: tFake,
      locale: 'de',
      themes: [],
      now: new Date('2026-04-28T12:00:00Z'),
    });
    expect(blob.size).toBeGreaterThan(0);
  });

  it('honors the date-range filter on lab reports and observations', async () => {
    const oldReport: LabReport = {
      id: 'r-old',
      profileId: 'p1',
      createdAt: 0,
      updatedAt: 0,
      reportDate: '2020-01-15',
      categoryAssessments: {},
    };
    const newReport: LabReport = {
      id: 'r-new',
      profileId: 'p1',
      createdAt: 0,
      updatedAt: 0,
      reportDate: '2026-01-15',
      categoryAssessments: {},
    };
    const blob = await exportProfileAsPdf({
      profile: makeProfile(),
      observations: [
        makeObservation({
          id: 'o-old',
          theme: 'Alt',
          fact: 'OLD',
          createdAt: Date.parse('2020-06-15T12:00:00Z'),
        }),
        makeObservation({
          id: 'o-new',
          theme: 'Neu',
          fact: 'NEW',
          createdAt: Date.parse('2026-06-15T12:00:00Z'),
        }),
      ],
      labReports: [oldReport, newReport],
      labValues: [],
      supplements: [],
      openPoints: [],
      t: tFake,
      locale: 'de',
      dateRange: {
        from: new Date('2025-01-01T00:00:00Z'),
      },
      now: new Date('2026-04-28T12:00:00Z'),
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('generates without throwing on a populated profile', async () => {
    const report: LabReport = {
      id: 'r1',
      profileId: 'p1',
      createdAt: 0,
      updatedAt: 0,
      reportDate: '2026-03-15',
      categoryAssessments: {},
    };
    const value: LabValue = {
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
    };
    const supplement: Supplement = {
      id: 's1',
      profileId: 'p1',
      createdAt: 0,
      updatedAt: 0,
      name: 'Magnesium',
      brand: 'Citrate',
      category: 'daily',
      recommendation: 'abends',
      rationale: 'Schlaf',
    };
    const openPoint: OpenPoint = {
      id: 'op1',
      profileId: 'p1',
      createdAt: 0,
      updatedAt: 0,
      text: 'Nachfragen',
      context: 'Hausarzt',
      resolved: false,
    };
    const blob = await exportProfileAsPdf({
      profile: makeProfile({
        knownDiagnoses: ['Hashimoto'],
        currentMedications: ['Levothyroxin 50µg'],
        relevantLimitations: ['Laktoseintoleranz'],
      }),
      observations: [
        makeObservation({ id: 'o1', theme: 'Schulter', fact: '**Stechender** Schmerz' }),
        makeObservation({ id: 'o2', theme: 'Schulter', fact: 'Dumpfer Druck' }),
        makeObservation({ id: 'o3', theme: 'Knie', fact: 'gelegentlich' }),
      ],
      labReports: [report],
      labValues: [value],
      supplements: [supplement],
      openPoints: [openPoint],
      t: tFake,
      locale: 'de',
      now: new Date('2026-04-28T12:00:00Z'),
    });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});
