import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../../crypto';
import { setupCompletedOnboarding } from '../../../db/test-helpers';
import { readMeta } from '../../../db/meta';
import {
  ProfileRepository,
  LabReportRepository,
  LabValueRepository,
} from '../../../db/repositories';
import { importProfile } from './importProfile';
import { UnresolvedConflictError } from '../../../domain/import-merge';
import type { ParseResult } from '../parser/types';

const TEST_PASSWORD = 'test-password-12';
let profileId: string;

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

  const profileRepo = new ProfileRepository();
  const profile = await profileRepo.create({
    baseData: {
      name: 'Mein Profil',
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
  profileId = profile.id;
});

function emptyParseResult(overrides: Partial<ParseResult> = {}): ParseResult {
  return {
    profile: null,
    observations: [],
    labReports: [],
    labValues: [],
    supplements: [],
    openPoints: [],
    profileVersions: [],
    timelineEntries: [],
    report: { recognized: [], warnings: [], unrecognized: [], metadata: {} },
    originalMarkdown: '',
    ...overrides,
  };
}

describe('importProfile lab-data merge mode (IM-06 Step 3b)', () => {
  it('W1 case 1: new report + new values into empty target = pure inserts with fresh FK', async () => {
    await importProfile(
      emptyParseResult({
        labReports: [{ reportDate: '2026-04-15', categoryAssessments: {} }],
        labValues: [
          {
            reportIndex: 0,
            reportId: '',
            category: 'Blutbild',
            parameter: 'Hämoglobin',
            result: '14.2',
          },
        ],
      }),
      profileId,
      { replaceExisting: { labData: 'merge' } },
    );
    const reports = await new LabReportRepository(new LabValueRepository()).listByProfile(
      profileId,
    );
    const values = await new LabValueRepository().listByProfile(profileId);
    expect(reports).toHaveLength(1);
    expect(values).toHaveLength(1);
    // FK consistency: child value points at the parent's id.
    expect(values[0]?.reportId).toBe(reports[0]?.id);
  });

  it('W1 case 2: new parsed report (different date) + existing report = both kept, FKs intact', async () => {
    const labReportRepo = new LabReportRepository(new LabValueRepository());
    const labValueRepo = new LabValueRepository();
    const existingReport = await labReportRepo.create({
      profileId,
      reportDate: '2025-01-01',
      categoryAssessments: {},
    });
    const existingValue = await labValueRepo.create({
      profileId,
      reportId: existingReport.id,
      category: 'Niere',
      parameter: 'Kreatinin',
      result: '0.95',
    });

    await importProfile(
      emptyParseResult({
        labReports: [{ reportDate: '2026-04-15', categoryAssessments: {} }],
        labValues: [
          {
            reportIndex: 0,
            reportId: '',
            category: 'Blutbild',
            parameter: 'Hämoglobin',
            result: '14.2',
          },
        ],
      }),
      profileId,
      { replaceExisting: { labData: 'merge' } },
    );
    const reports = await labReportRepo.listByProfile(profileId);
    const values = await labValueRepo.listByProfile(profileId);
    expect(reports).toHaveLength(2);
    expect(values).toHaveLength(2);
    // Existing pair untouched.
    const oldReport = reports.find((r) => r.id === existingReport.id);
    expect(oldReport?.reportDate).toBe('2025-01-01');
    const oldValue = values.find((v) => v.id === existingValue.id);
    expect(oldValue?.parameter).toBe('Kreatinin');
    expect(oldValue?.reportId).toBe(existingReport.id);
    // New pair: child references new parent.
    const newReport = reports.find((r) => r.id !== existingReport.id);
    const newValue = values.find((v) => v.id !== existingValue.id);
    expect(newValue?.reportId).toBe(newReport?.id);
  });

  it('W1 case 4 + Q4 silent-merge: matched report (same date) + new parameter = additive insert under existing parent id', async () => {
    const labReportRepo = new LabReportRepository(new LabValueRepository());
    const labValueRepo = new LabValueRepository();
    const existingReport = await labReportRepo.create({
      profileId,
      reportDate: '2026-04-15',
      labName: 'Synlab',
      categoryAssessments: {},
    });
    const existingValue = await labValueRepo.create({
      profileId,
      reportId: existingReport.id,
      category: 'Blutbild',
      parameter: 'Hämoglobin',
      result: '14.2',
    });

    await importProfile(
      emptyParseResult({
        // Same reportDate as existing -> report-level identical (no
        // field changes; labName unchanged) -> resolves as identical.
        labReports: [{ reportDate: '2026-04-15', labName: 'Synlab', categoryAssessments: {} }],
        labValues: [
          // Same parameter as existing, same result -> value-level
          // identical -> no-op.
          {
            reportIndex: 0,
            reportId: '',
            category: 'Blutbild',
            parameter: 'Hämoglobin',
            result: '14.2',
          },
          // New parameter under matched parent -> Q4 silent additive
          // insert, no resolution required.
          {
            reportIndex: 0,
            reportId: '',
            category: 'Niere',
            parameter: 'Kreatinin',
            result: '0.95',
          },
        ],
      }),
      profileId,
      { replaceExisting: { labData: 'merge' } },
    );
    const reports = await labReportRepo.listByProfile(profileId);
    const values = await labValueRepo.listByProfile(profileId);
    // One report (existing), two values (existing + new Kreatinin).
    expect(reports).toHaveLength(1);
    expect(reports[0]?.id).toBe(existingReport.id);
    expect(values).toHaveLength(2);
    // Existing value still there.
    const hb = values.find((v) => v.parameter === 'Hämoglobin');
    expect(hb?.id).toBe(existingValue.id);
    // New value bound to existing report id (FK rewiring).
    const kreatinin = values.find((v) => v.parameter === 'Kreatinin');
    expect(kreatinin?.reportId).toBe(existingReport.id);
  });

  it('W1 case 3: matched report + value-conflict resolution=theirs preserves existing reportId on update', async () => {
    const labReportRepo = new LabReportRepository(new LabValueRepository());
    const labValueRepo = new LabValueRepository();
    const existingReport = await labReportRepo.create({
      profileId,
      reportDate: '2026-04-15',
      categoryAssessments: {},
    });
    const existingValue = await labValueRepo.create({
      profileId,
      reportId: existingReport.id,
      category: 'Blutbild',
      parameter: 'Hämoglobin',
      result: '14.2',
    });

    await importProfile(
      emptyParseResult({
        labReports: [{ reportDate: '2026-04-15', categoryAssessments: {} }],
        labValues: [
          {
            reportIndex: 0,
            reportId: '',
            category: 'Blutbild',
            parameter: 'Hämoglobin',
            result: '13.5', // <- differs from existing 14.2 -> conflict
          },
        ],
      }),
      profileId,
      {
        replaceExisting: { labData: 'merge' },
        resolutions: {
          labValues: {
            [existingValue.id]: { kind: 'theirs' },
          },
        },
      },
    );
    const values = await labValueRepo.listByProfile(profileId);
    expect(values).toHaveLength(1);
    // Same row id (updated, not inserted).
    expect(values[0]?.id).toBe(existingValue.id);
    expect(values[0]?.result).toBe('13.5');
    // FK preserved (existing reportId not overwritten by patch).
    expect(values[0]?.reportId).toBe(existingReport.id);
  });

  it('matched report + value-conflict + resolution=mine preserves existing value and FK', async () => {
    const labReportRepo = new LabReportRepository(new LabValueRepository());
    const labValueRepo = new LabValueRepository();
    const existingReport = await labReportRepo.create({
      profileId,
      reportDate: '2026-04-15',
      categoryAssessments: {},
    });
    const existingValue = await labValueRepo.create({
      profileId,
      reportId: existingReport.id,
      category: 'Blutbild',
      parameter: 'Hämoglobin',
      result: '14.2',
    });

    await importProfile(
      emptyParseResult({
        labReports: [{ reportDate: '2026-04-15', categoryAssessments: {} }],
        labValues: [
          {
            reportIndex: 0,
            reportId: '',
            category: 'Blutbild',
            parameter: 'Hämoglobin',
            result: '13.5',
          },
        ],
      }),
      profileId,
      {
        replaceExisting: { labData: 'merge' },
        resolutions: {
          labValues: {
            [existingValue.id]: { kind: 'mine' },
          },
        },
      },
    );
    const values = await labValueRepo.listByProfile(profileId);
    expect(values).toHaveLength(1);
    expect(values[0]?.result).toBe('14.2');
    expect(values[0]?.reportId).toBe(existingReport.id);
  });

  it('UnresolvedConflictError throws on missing value-conflict resolution; vault unchanged', async () => {
    const labReportRepo = new LabReportRepository(new LabValueRepository());
    const labValueRepo = new LabValueRepository();
    const existingReport = await labReportRepo.create({
      profileId,
      reportDate: '2026-04-15',
      categoryAssessments: {},
    });
    const existingValue = await labValueRepo.create({
      profileId,
      reportId: existingReport.id,
      category: 'Blutbild',
      parameter: 'Hämoglobin',
      result: '14.2',
    });

    await expect(() =>
      importProfile(
        emptyParseResult({
          labReports: [{ reportDate: '2026-04-15', categoryAssessments: {} }],
          labValues: [
            {
              reportIndex: 0,
              reportId: '',
              category: 'Blutbild',
              parameter: 'Hämoglobin',
              result: '13.5',
            },
          ],
        }),
        profileId,
        { replaceExisting: { labData: 'merge' } },
      ),
    ).rejects.toThrow(UnresolvedConflictError);

    // W4 atomicity: vault unchanged.
    const reports = await labReportRepo.listByProfile(profileId);
    const values = await labValueRepo.listByProfile(profileId);
    expect(reports).toHaveLength(1);
    expect(values).toHaveLength(1);
    expect(values[0]?.id).toBe(existingValue.id);
    expect(values[0]?.result).toBe('14.2');
  });

  it('W6 cross-report parameter independence: same parameter under different reportDates stays distinct', async () => {
    const labReportRepo = new LabReportRepository(new LabValueRepository());
    const labValueRepo = new LabValueRepository();
    const oldReport = await labReportRepo.create({
      profileId,
      reportDate: '2025-01-01',
      categoryAssessments: {},
    });
    await labValueRepo.create({
      profileId,
      reportId: oldReport.id,
      category: 'Niere',
      parameter: 'Kreatinin',
      result: '0.95',
    });

    // Parsed: a NEW report (2026-04-15) with a Kreatinin value. Even
    // though the parameter name collides with the existing report's
    // value, they belong to different parent reports -> matchEntities
    // scopes value-matching per parent -> the new value bucket is
    // 'new', NOT 'conflict' against the old report's Kreatinin.
    await importProfile(
      emptyParseResult({
        labReports: [{ reportDate: '2026-04-15', categoryAssessments: {} }],
        labValues: [
          {
            reportIndex: 0,
            reportId: '',
            category: 'Niere',
            parameter: 'Kreatinin',
            result: '1.05',
          },
        ],
      }),
      profileId,
      { replaceExisting: { labData: 'merge' } },
    );
    const reports = await labReportRepo.listByProfile(profileId);
    const values = await labValueRepo.listByProfile(profileId);
    expect(reports).toHaveLength(2);
    expect(values).toHaveLength(2);
    // Each Kreatinin reading is bound to the correct parent report.
    const oldKreatinin = values.find((v) => v.reportId === oldReport.id);
    const newReport = reports.find((r) => r.id !== oldReport.id);
    const newKreatinin = values.find((v) => v.reportId === newReport?.id);
    expect(oldKreatinin?.result).toBe('0.95');
    expect(newKreatinin?.result).toBe('1.05');
  });

  it('Q4 silent-merge with W1 case 4 mixed: matched report adds two new params under existing parent id', async () => {
    const labReportRepo = new LabReportRepository(new LabValueRepository());
    const labValueRepo = new LabValueRepository();
    const existingReport = await labReportRepo.create({
      profileId,
      reportDate: '2026-04-15',
      categoryAssessments: {},
    });
    await labValueRepo.create({
      profileId,
      reportId: existingReport.id,
      category: 'Blutbild',
      parameter: 'Hämoglobin',
      result: '14.2',
    });

    await importProfile(
      emptyParseResult({
        labReports: [{ reportDate: '2026-04-15', categoryAssessments: {} }],
        labValues: [
          {
            reportIndex: 0,
            reportId: '',
            category: 'Niere',
            parameter: 'Kreatinin',
            result: '0.95',
          },
          {
            reportIndex: 0,
            reportId: '',
            category: 'Schilddrüse',
            parameter: 'TSH',
            result: '2.4',
          },
        ],
      }),
      profileId,
      { replaceExisting: { labData: 'merge' } },
    );
    const values = await labValueRepo.listByProfile(profileId);
    expect(values).toHaveLength(3);
    // All bound to the existing parent.
    for (const v of values) {
      expect(v.reportId).toBe(existingReport.id);
    }
    expect(values.map((v) => v.parameter).sort()).toEqual(['Hämoglobin', 'Kreatinin', 'TSH']);
  });

  it('lab-data merge alongside other modes: labData=merge + observations=replace honours both', async () => {
    const labReportRepo = new LabReportRepository(new LabValueRepository());
    const labValueRepo = new LabValueRepository();
    await labReportRepo.create({
      profileId,
      reportDate: '2025-01-01',
      categoryAssessments: {},
    });

    await importProfile(
      emptyParseResult({
        labReports: [{ reportDate: '2026-04-15', categoryAssessments: {} }],
        labValues: [
          {
            reportIndex: 0,
            reportId: '',
            category: 'Blutbild',
            parameter: 'Hämoglobin',
            result: '14.0',
          },
        ],
      }),
      profileId,
      {
        replaceExisting: {
          labData: 'merge',
          observations: 'replace',
        },
      },
    );
    const reports = await labReportRepo.listByProfile(profileId);
    expect(reports).toHaveLength(2);
    const values = await labValueRepo.listByProfile(profileId);
    expect(values).toHaveLength(1);
  });
});
