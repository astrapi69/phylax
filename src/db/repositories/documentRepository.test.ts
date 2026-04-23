import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock } from '../../crypto';
import { setupCompletedOnboarding } from '../test-helpers';
import { ProfileRepository } from './profileRepository';
import { DocumentRepository, NotImplementedError } from './documentRepository';
import { db } from '../schema';
import type { Document } from '../../domain';

const TEST_PASSWORD = 'test-password-12';

let profileId: string;
let repo: DocumentRepository;

function makeMetadata(
  overrides: Partial<Omit<Document, 'id' | 'createdAt' | 'updatedAt'>> = {},
): Omit<Document, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    profileId: overrides.profileId ?? profileId,
    filename: overrides.filename ?? 'report.pdf',
    mimeType: overrides.mimeType ?? 'application/pdf',
    sizeBytes: overrides.sizeBytes ?? 2048,
    description: overrides.description,
    linkedObservationId: overrides.linkedObservationId,
    linkedLabValueId: overrides.linkedLabValueId,
  };
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const { readMeta } = await import('../meta');
  const { unlock } = await import('../../crypto');
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

  const profileRepo = new ProfileRepository();
  const profile = await profileRepo.create({
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
  profileId = profile.id;
  repo = new DocumentRepository();
});

describe('DocumentRepository (D-01 foundation)', () => {
  describe('schema', () => {
    it('opens at schema v3 with both documents and document_blobs tables', () => {
      expect(db.verno).toBeGreaterThanOrEqual(3);
      expect(db.documents).toBeDefined();
      expect(db.documentBlobs).toBeDefined();
    });
  });

  describe('metadata CRUD (inherited EncryptedRepository path)', () => {
    it('round-trips document metadata through encrypt/decrypt', async () => {
      // Bypass the `create` override by going through the base class's
      // serialize/put path. D-03 will provide a blob-aware `create`.
      const row = await repo.serialize({
        ...makeMetadata({
          filename: 'scan.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1234,
          description: 'Doctor visit scan from 2026-03-15',
        }),
        id: 'doc-1',
        createdAt: 100,
        updatedAt: 100,
      });
      await db.documents.put(row);

      const readBack = await repo.getById('doc-1');
      expect(readBack).not.toBeNull();
      expect(readBack?.filename).toBe('scan.pdf');
      expect(readBack?.mimeType).toBe('application/pdf');
      expect(readBack?.sizeBytes).toBe(1234);
      expect(readBack?.description).toBe('Doctor visit scan from 2026-03-15');
      expect(readBack?.profileId).toBe(profileId);
    });

    it('getMetadata is equivalent to getById', async () => {
      const row = await repo.serialize({
        ...makeMetadata({ filename: 'alias.pdf' }),
        id: 'doc-alias',
        createdAt: 100,
        updatedAt: 100,
      });
      await db.documents.put(row);

      const viaGetById = await repo.getById('doc-alias');
      const viaGetMetadata = await repo.getMetadata('doc-alias');
      expect(viaGetMetadata).toEqual(viaGetById);
    });

    it("listByProfile returns only this profile's documents", async () => {
      const otherProfile = await new ProfileRepository().create({
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

      const mineRow = await repo.serialize({
        ...makeMetadata({ filename: 'mine.pdf' }),
        id: 'doc-mine',
        createdAt: 100,
        updatedAt: 100,
      });
      const theirsRow = await repo.serialize({
        ...makeMetadata({ profileId: otherProfile.id, filename: 'theirs.pdf' }),
        id: 'doc-theirs',
        createdAt: 100,
        updatedAt: 100,
      });
      await db.documents.bulkPut([mineRow, theirsRow]);

      const mine = await repo.listByProfile(profileId);
      expect(mine).toHaveLength(1);
      expect(mine[0]?.filename).toBe('mine.pdf');

      const theirs = await repo.listByProfile(otherProfile.id);
      expect(theirs).toHaveLength(1);
      expect(theirs[0]?.filename).toBe('theirs.pdf');
    });
  });

  describe('delete enforces the two-row invariant', () => {
    it('removes both metadata and blob rows atomically', async () => {
      const metadataRow = await repo.serialize({
        ...makeMetadata({ filename: 'paired.pdf' }),
        id: 'doc-paired',
        createdAt: 100,
        updatedAt: 100,
      });
      await db.documents.put(metadataRow);
      // Simulate a D-03 blob row so we can prove delete clears it too.
      await db.documentBlobs.put({ id: 'doc-paired', payload: new ArrayBuffer(32) });

      await repo.delete('doc-paired');

      expect(await db.documents.get('doc-paired')).toBeUndefined();
      expect(await db.documentBlobs.get('doc-paired')).toBeUndefined();
    });

    it('is idempotent when rows are already missing', async () => {
      await expect(repo.delete('never-existed')).resolves.toBeUndefined();
    });

    it('removes a lone metadata row even without a matching blob', async () => {
      const metadataRow = await repo.serialize({
        ...makeMetadata({ filename: 'lonely-meta.pdf' }),
        id: 'doc-lonely-meta',
        createdAt: 100,
        updatedAt: 100,
      });
      await db.documents.put(metadataRow);

      await repo.delete('doc-lonely-meta');

      expect(await db.documents.get('doc-lonely-meta')).toBeUndefined();
    });

    it('removes a lone blob row even without matching metadata', async () => {
      await db.documentBlobs.put({ id: 'doc-lonely-blob', payload: new ArrayBuffer(16) });

      await repo.delete('doc-lonely-blob');

      expect(await db.documentBlobs.get('doc-lonely-blob')).toBeUndefined();
    });
  });

  describe('D-03 stubs throw NotImplementedError until blob encryption lands', () => {
    it('create throws NotImplementedError', async () => {
      await expect(
        repo.create({
          ...makeMetadata(),
          content: new ArrayBuffer(64),
        }),
      ).rejects.toThrow(NotImplementedError);
    });

    it('getContent throws NotImplementedError', async () => {
      await expect(repo.getContent('any-id')).rejects.toThrow(NotImplementedError);
    });
  });
});
