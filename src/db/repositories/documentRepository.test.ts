import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { lock } from '../../crypto';
import { setupCompletedOnboarding } from '../test-helpers';
import { ProfileRepository } from './profileRepository';
import {
  DocumentRepository,
  DocumentSizeLimitError,
  DOCUMENT_SIZE_LIMIT_BYTES,
} from './documentRepository';
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

  describe('blob encryption (D-03)', () => {
    function makeBytes(n: number, seed = 0): ArrayBuffer {
      const buf = new ArrayBuffer(n);
      const view = new Uint8Array(buf);
      for (let i = 0; i < n; i++) view[i] = (i + seed) & 0xff;
      return buf;
    }

    it('create then getContent returns byte-for-byte identical content', async () => {
      const content = makeBytes(2048, 7);
      const created = await repo.create({ ...makeMetadata(), content });

      expect(created.id).toBeTruthy();
      expect(created.profileId).toBe(profileId);

      const readBack = await repo.getContent(created.id);
      if (!readBack) throw new Error('expected content present after create');
      expect(readBack.byteLength).toBe(content.byteLength);
      expect(new Uint8Array(readBack)).toEqual(new Uint8Array(content));
    });

    it('persists both metadata and blob rows in a single transaction', async () => {
      const created = await repo.create({
        ...makeMetadata({ filename: 'paired.png', mimeType: 'image/png' }),
        content: makeBytes(64),
      });

      const metadataRow = await db.documents.get(created.id);
      const blobRow = await db.documentBlobs.get(created.id);
      expect(metadataRow).toBeDefined();
      if (!blobRow) throw new Error('blob row missing after create');
      // Blob payload is the AES-GCM ciphertext (12-byte IV + ct + 16-byte tag),
      // larger than the plaintext but bounded to plaintext + 28.
      expect(blobRow.payload.byteLength).toBe(64 + 12 + 16);
    });

    it('round-trips a realistic PDF magic-header + body', async () => {
      const header = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);
      const body = new Uint8Array(makeBytes(8192, 13));
      const merged = new Uint8Array(header.byteLength + body.byteLength);
      merged.set(header, 0);
      merged.set(body, header.byteLength);

      const created = await repo.create({
        ...makeMetadata({ filename: 'doc.pdf', mimeType: 'application/pdf' }),
        content: merged.buffer,
      });

      const readBack = await repo.getContent(created.id);
      if (!readBack) throw new Error('expected pdf content after create');
      expect(new Uint8Array(readBack)).toEqual(merged);
    });

    it('round-trips the all-zero edge case', async () => {
      const content = new ArrayBuffer(1024);
      const created = await repo.create({ ...makeMetadata(), content });
      const readBack = await repo.getContent(created.id);
      if (!readBack) throw new Error('expected zero-buffer content after create');
      expect(new Uint8Array(readBack)).toEqual(new Uint8Array(content));
    });

    it('rejects content exceeding DOCUMENT_SIZE_LIMIT_BYTES with DocumentSizeLimitError', async () => {
      const oversized = new ArrayBuffer(DOCUMENT_SIZE_LIMIT_BYTES + 1);
      await expect(repo.create({ ...makeMetadata(), content: oversized })).rejects.toThrow(
        DocumentSizeLimitError,
      );

      // Defense-in-depth: nothing got persisted.
      const all = await db.documents.where('profileId').equals(profileId).toArray();
      expect(all).toHaveLength(0);
      const blobs = await db.documentBlobs.toArray();
      expect(blobs).toHaveLength(0);
    });

    it('accepts content at exactly DOCUMENT_SIZE_LIMIT_BYTES', async () => {
      // Use a small marker pattern at boundaries instead of allocating
      // 10 MB of explicit data; verify byteLength equality only.
      const exact = new ArrayBuffer(DOCUMENT_SIZE_LIMIT_BYTES);
      const view = new Uint8Array(exact);
      view[0] = 0xab;
      view[view.byteLength - 1] = 0xcd;

      const created = await repo.create({ ...makeMetadata(), content: exact });
      const readBack = await repo.getContent(created.id);
      if (!readBack) throw new Error('expected size-limit content after create');
      expect(readBack.byteLength).toBe(DOCUMENT_SIZE_LIMIT_BYTES);
      const readView = new Uint8Array(readBack);
      expect(readView[0]).toBe(0xab);
      expect(readView[DOCUMENT_SIZE_LIMIT_BYTES - 1]).toBe(0xcd);
    });

    it('getContent returns null for a missing blob row (orphaned metadata)', async () => {
      const metadataRow = await repo.serialize({
        ...makeMetadata({ filename: 'orphan.pdf' }),
        id: 'doc-orphan',
        createdAt: 100,
        updatedAt: 100,
      });
      await db.documents.put(metadataRow);
      // No blob row inserted.

      const result = await repo.getContent('doc-orphan');
      expect(result).toBeNull();
    });

    it('getContent returns null for an unknown id', async () => {
      const result = await repo.getContent('does-not-exist');
      expect(result).toBeNull();
    });

    it('rejects when the blob ciphertext is tampered (AES-GCM auth-tag mismatch)', async () => {
      const created = await repo.create({
        ...makeMetadata(),
        content: makeBytes(256, 42),
      });

      // Flip a byte in the auth-tag region of the ciphertext.
      const blobRow = await db.documentBlobs.get(created.id);
      if (!blobRow) throw new Error('blob row missing after create');
      const tampered = new Uint8Array(blobRow.payload);
      const idx = tampered.length - 8;
      const byte = tampered[idx] ?? 0;
      tampered[idx] = byte ^ 0x01;
      await db.documentBlobs.put({
        id: created.id,
        payload: tampered.buffer,
      });

      await expect(repo.getContent(created.id)).rejects.toThrow();
    });

    it('create scopes the new document to the input profileId (cross-profile isolation)', async () => {
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

      const inMine = await repo.create({
        ...makeMetadata({ filename: 'mine-blob.pdf' }),
        content: makeBytes(128),
      });
      const inTheirs = await repo.create({
        ...makeMetadata({ profileId: otherProfile.id, filename: 'theirs-blob.pdf' }),
        content: makeBytes(128),
      });

      const mineList = await repo.listByProfile(profileId);
      expect(mineList.map((d) => d.id)).toContain(inMine.id);
      expect(mineList.map((d) => d.id)).not.toContain(inTheirs.id);
      // getContent doesn't enforce profileId scoping by design — list is
      // the boundary. Documented behavior; an `assertOwnership(id, profileId)`
      // helper can layer on top later if a viewer needs hard isolation.
      expect(await repo.getContent(inMine.id)).not.toBeNull();
      expect(await repo.getContent(inTheirs.id)).not.toBeNull();
    });

    it('delete after create clears both rows', async () => {
      const created = await repo.create({
        ...makeMetadata(),
        content: makeBytes(64),
      });
      await repo.delete(created.id);

      expect(await db.documents.get(created.id)).toBeUndefined();
      expect(await db.documentBlobs.get(created.id)).toBeUndefined();
    });
  });
});
