import { db } from '../schema';
import type { Document } from '../../domain';
import { encryptWithStoredKey, decryptWithStoredKey, generateId } from '../../crypto';
import { EncryptedRepository } from './encryptedRepository';
import type { DocumentBlobRow } from '../types';

/**
 * Error thrown when a document upload exceeds the per-file size cap.
 * Caught by the upload UI (D-02) for a localized error message;
 * thrown unconditionally by the repository as defense in depth so
 * the cap survives any UI bypass (programmatic call, devtools).
 */
export class DocumentSizeLimitError extends Error {
  constructor(
    public readonly actualBytes: number,
    public readonly limitBytes: number = DOCUMENT_SIZE_LIMIT_BYTES,
  ) {
    super(`Document exceeds size limit: ${actualBytes} bytes > ${limitBytes} bytes`);
    this.name = 'DocumentSizeLimitError';
  }
}

/** 10 MB per-file cap (Phase 4 D-02 UI + defense-in-depth in repo). */
export const DOCUMENT_SIZE_LIMIT_BYTES = 10 * 1024 * 1024;

/**
 * Input shape for `DocumentRepository.create`. Mirrors the inherited
 * `EncryptedRepository.create` shape but adds the binary `content`
 * the blob row carries.
 */
export type DocumentCreateInput = Omit<Document, 'id' | 'createdAt' | 'updatedAt'> & {
  content: ArrayBuffer;
};

/**
 * Repository for document entities.
 *
 * Two-row storage pattern (D-01):
 * - `documents` table: encrypted metadata via the inherited
 *   JSON-encrypt-then-AES pipeline. List-view reads stay cheap because
 *   no binary content travels through this row.
 * - `document_blobs` table: encrypted binary content (raw AES-256-GCM
 *   over the ArrayBuffer, no JSON / base64 detour), keyed by the same
 *   `id`. Only read when a viewer explicitly requests the bytes via
 *   `getContent`.
 *
 * Invariant: every metadata row has exactly one blob row and vice
 * versa. `create` and `delete` enforce the pair inside a Dexie
 * transaction. `getContent` returns `null` if the blob row is missing
 * (orphaned-metadata edge case; let the caller decide whether to
 * surface as "broken document" or trigger a delete repair).
 */
export class DocumentRepository extends EncryptedRepository<Document> {
  constructor() {
    super(db.documents);
  }

  /**
   * Create a document with encrypted metadata + encrypted blob in a
   * single transaction.
   *
   * Pre-encrypts both the metadata JSON payload and the raw blob
   * BEFORE opening the Dexie transaction. Dexie commits a transaction
   * as soon as it observes an `await` on a non-Dexie promise; doing
   * `crypto.subtle.*` inside the transaction body therefore aborts
   * the write half-done. Same constraint that motivates the
   * `EncryptedRepository.serialize` pre-encrypt pattern, applied
   * here for the blob too.
   *
   * Throws `DocumentSizeLimitError` for content larger than
   * `DOCUMENT_SIZE_LIMIT_BYTES` (defense in depth; D-02's UI gates
   * this earlier with a localized message).
   */
  override async create(data: DocumentCreateInput): Promise<Document> {
    if (data.content.byteLength > DOCUMENT_SIZE_LIMIT_BYTES) {
      throw new DocumentSizeLimitError(data.content.byteLength);
    }

    const { content, ...metadata } = data;
    const now = Date.now();
    const id = generateId();
    const entity: Document = {
      ...metadata,
      id,
      createdAt: now,
      updatedAt: now,
    };

    // Pre-encrypt outside the transaction (see method JSDoc).
    const metadataRow = await this.serialize(entity);
    const encryptedBlob = await encryptWithStoredKey(new Uint8Array(content));
    const blobRow: DocumentBlobRow = {
      id,
      payload: copyToFreshArrayBuffer(encryptedBlob),
    };

    await db.transaction('rw', db.documents, db.documentBlobs, async () => {
      await db.documents.put(metadataRow);
      await db.documentBlobs.put(blobRow);
    });

    return entity;
  }

  /**
   * Fetch + decrypt the binary content for a document. Returns null
   * if the blob row is missing (orphaned metadata or unknown id).
   *
   * Throws if the keystore is locked (propagated from
   * `decryptWithStoredKey`) or if the ciphertext is tampered (AES-GCM
   * auth-tag verification failure surfaces as a decrypt error).
   */
  async getContent(id: string): Promise<ArrayBuffer | null> {
    const row = await db.documentBlobs.get(id);
    if (!row) return null;
    const decrypted = await decryptWithStoredKey(new Uint8Array(row.payload));
    return copyToFreshArrayBuffer(decrypted);
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

/**
 * Return a fresh ArrayBuffer that owns exactly the bytes of `view`.
 *
 * `Uint8Array#buffer` may share a larger underlying buffer (e.g. when
 * the view is a slice of a pool); writing the raw `.buffer` to Dexie
 * persists the entire backing buffer, leaking unrelated bytes and
 * inflating storage. Likewise on read, callers expect an ArrayBuffer
 * of exactly `byteLength` bytes. This helper guarantees both.
 */
function copyToFreshArrayBuffer(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}
