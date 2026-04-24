import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import {
  DocumentRepository,
  LabReportRepository,
  LabValueRepository,
  ObservationRepository,
  OpenPointRepository,
  ProfileRepository,
  SupplementRepository,
} from '../../db/repositories';
import { countDerivedEntities, deleteWithProvenance } from './deleteWithProvenance';

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

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
});

describe('countDerivedEntities', () => {
  it('returns zero counts when nothing references the document', async () => {
    const profileId = await ensureProfile();
    await new ObservationRepository().create({
      profileId,
      theme: 'A',
      fact: 'f',
      pattern: 'p',
      selfRegulation: 's',
      status: 'ok',
      source: 'user',
      extraSections: {},
    });
    const counts = await countDerivedEntities('doc-nonexistent');
    expect(counts).toEqual({
      observations: 0,
      labValues: 0,
      labReports: 0,
      supplements: 0,
      openPoints: 0,
      total: 0,
    });
  });

  it('sums per-type matches across all five repositories', async () => {
    const profileId = await ensureProfile();
    const docId = 'doc-1';
    await new ObservationRepository().create({
      profileId,
      theme: 'A',
      fact: 'f',
      pattern: 'p',
      selfRegulation: 's',
      status: 'ok',
      source: 'ai',
      extraSections: {},
      sourceDocumentId: docId,
    });
    const valueRepo = new LabValueRepository();
    await new LabReportRepository(valueRepo).create({
      profileId,
      reportDate: '2026-04-01',
      categoryAssessments: {},
      sourceDocumentId: docId,
    });
    await valueRepo.create({
      profileId,
      reportId: 'r1',
      category: 'Blutbild',
      parameter: 'Hb',
      result: '14',
      sourceDocumentId: docId,
    });
    await new SupplementRepository().create({
      profileId,
      name: 'Vit D',
      category: 'daily',
      sourceDocumentId: docId,
    });
    await new OpenPointRepository().create({
      profileId,
      text: 'X',
      context: 'Y',
      resolved: false,
      sourceDocumentId: docId,
    });
    const counts = await countDerivedEntities(docId);
    expect(counts).toEqual({
      observations: 1,
      labValues: 1,
      labReports: 1,
      supplements: 1,
      openPoints: 1,
      total: 5,
    });
  });
});

describe('deleteWithProvenance', () => {
  it('clears sourceDocumentId on derived entities and deletes the Document', async () => {
    const profileId = await ensureProfile();
    const docRepo = new DocumentRepository();
    const file = await docRepo.create({
      profileId,
      filename: 'src.txt',
      mimeType: 'text/plain',
      sizeBytes: 5,
      content: new TextEncoder().encode('hello').buffer as ArrayBuffer,
    });
    const obsRepo = new ObservationRepository();
    const obs = await obsRepo.create({
      profileId,
      theme: 'A',
      fact: 'f',
      pattern: 'p',
      selfRegulation: 's',
      status: 'ok',
      source: 'ai',
      extraSections: {},
      sourceDocumentId: file.id,
    });

    const result = await deleteWithProvenance(file.id);
    expect(result.kind).toBe('ok');

    const docAfter = await docRepo.getById(file.id);
    expect(docAfter).toBeNull();
    const obsAfter = await obsRepo.getById(obs.id);
    expect(obsAfter?.sourceDocumentId).toBeUndefined();
  });

  it('returns cleanup-failed and does NOT delete the Document when ref clearing throws', async () => {
    const profileId = await ensureProfile();
    const docRepo = new DocumentRepository();
    const file = await docRepo.create({
      profileId,
      filename: 'src.txt',
      mimeType: 'text/plain',
      sizeBytes: 5,
      content: new TextEncoder().encode('hello').buffer as ArrayBuffer,
    });
    const obsRepo = new ObservationRepository();
    await obsRepo.create({
      profileId,
      theme: 'A',
      fact: 'f',
      pattern: 'p',
      selfRegulation: 's',
      status: 'ok',
      source: 'ai',
      extraSections: {},
      sourceDocumentId: file.id,
    });

    const failingObs = new ObservationRepository();
    failingObs.update = async () => {
      throw new Error('crypto failure');
    };

    const result = await deleteWithProvenance(file.id, {
      repos: { observation: failingObs, document: docRepo },
    });
    expect(result.kind).toBe('cleanup-failed');

    const docStill = await docRepo.getById(file.id);
    expect(docStill).not.toBeNull();
  });

  it('proceeds when there are no derived entities (delete-only path)', async () => {
    const profileId = await ensureProfile();
    const docRepo = new DocumentRepository();
    const file = await docRepo.create({
      profileId,
      filename: 'orphan.txt',
      mimeType: 'text/plain',
      sizeBytes: 5,
      content: new TextEncoder().encode('hello').buffer as ArrayBuffer,
    });
    const result = await deleteWithProvenance(file.id);
    expect(result.kind).toBe('ok');
    expect(await docRepo.getById(file.id)).toBeNull();
  });
});
