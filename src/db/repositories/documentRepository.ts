import { db } from '../schema';
import type { Document } from '../../domain';
import { EncryptedRepository } from './encryptedRepository';

/**
 * Error thrown when a caller reaches a feature path that is registered
 * but not yet implemented. D-01 defines the storage contract and the
 * metadata half of the API. D-03 (blob encryption) fills in the body
 * of `create` and `getContent`.
 */
export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not yet implemented. Tracked as Phase 4 follow-up.`);
    this.name = 'NotImplementedError';
  }
}

/** 10 MB per-file cap (Phase 4 D-02 UI + defense-in-depth in repo). */
export const DOCUMENT_SIZE_LIMIT_BYTES = 10 * 1024 * 1024;

/**
 * Repository for document entities.
 *
 * Two-row storage pattern (D-01):
 * - `documents` table: encrypted metadata via the inherited
 *   JSON-encrypt-then-AES pipeline. List-view reads stay cheap because
 *   no binary content travels through this row.
 * - `document_blobs` table: encrypted binary content, keyed by the
 *   same `id`. Only read when a viewer explicitly requests the bytes.
 *
 * Invariant: every metadata row has exactly one blob row and vice
 * versa. `create` and `delete` enforce the pair inside a Dexie
 * transaction. `getContent` returns `null` if either side is missing
 * (repair by delete, do not attempt to silently reconstruct).
 *
 * Metadata-only methods (`getById`, `getMetadata`, `listByProfile`,
 * `delete`) are inherited or implemented over the parent repository
 * and are usable now. Content-carrying methods (`create`,
 * `getContent`) throw `NotImplementedError` until D-03.
 */
export class DocumentRepository extends EncryptedRepository<Document> {
  constructor() {
    super(db.documents);
  }

  /**
   * Create a document with encrypted metadata + encrypted blob in a
   * single transaction.
   *
   * Not yet implemented — the blob-encryption pipeline lands in D-03.
   * Calling the inherited `EncryptedRepository.create` directly would
   * silently skip the blob row and violate the two-row invariant, so
   * this override shadows the base method and throws until D-03.
   */
  override create(
    _data: Omit<Document, 'id' | 'createdAt' | 'updatedAt'> & {
      content: ArrayBuffer;
    },
  ): Promise<Document> {
    return Promise.reject(new NotImplementedError('DocumentRepository.create (D-03)'));
  }

  /**
   * Fetch + decrypt the binary content for a document. Returns null
   * if the blob row is missing.
   *
   * Not yet implemented — the blob-decryption pipeline lands in D-03.
   */
  getContent(_id: string): Promise<ArrayBuffer | null> {
    return Promise.reject(new NotImplementedError('DocumentRepository.getContent (D-03)'));
  }

  /**
   * Metadata-only fetch. Equivalent to `getById`; exposed under an
   * explicit name so viewer components that need only the header row
   * (filename, size, mime type) make the intent clear at call site and
   * can be linted against accidentally pulling blob content.
   */
  getMetadata(id: string): Promise<Document | null> {
    return this.getById(id);
  }

  /**
   * Delete both metadata and blob in a single transaction.
   *
   * Overrides the base `delete` to also remove the matching
   * `document_blobs` row, keeping the two-row invariant intact.
   * Safe when either row is missing (idempotent cleanup).
   */
  override async delete(id: string): Promise<void> {
    await db.transaction('rw', db.documents, db.documentBlobs, async () => {
      await db.documents.delete(id);
      await db.documentBlobs.delete(id);
    });
  }
}
