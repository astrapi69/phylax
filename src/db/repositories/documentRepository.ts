import { db } from '../schema';
import type { Document } from '../../domain';
import { encryptWithStoredKey, decryptWithStoredKey, generateId } from '../../crypto';
import { EncryptedRepository } from './encryptedRepository';
import { validateDocumentLinks } from '../../domain/document/validation';
import type { DocumentBlobRow } from '../types';

export { DocumentLinkConflictError } from '../../domain/document/validation';

type DocumentPatch = Partial<Omit<Document, 'id' | 'profileId' | 'createdAt'>>;

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
    validateDocumentLinks(data);

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
   * Validate link fields before delegating to the inherited update.
   * If the patch touches either link field, the final state (existing
   * merged with patch) must satisfy `validateDocumentLinks`. Rejects
   * with `DocumentLinkConflictError` before any persistence side
   * effect runs.
   */
  override async update(id: string, patch: DocumentPatch): Promise<Document> {
    if ('linkedObservationId' in patch || 'linkedLabValueId' in patch) {
      const existing = await this.getById(id);
      if (existing) {
        const finalLinks = {
          linkedObservationId:
            'linkedObservationId' in patch
              ? patch.linkedObservationId
              : existing.linkedObservationId,
          linkedLabValueId:
            'linkedLabValueId' in patch ? patch.linkedLabValueId : existing.linkedLabValueId,
        };
        validateDocumentLinks(finalLinks);
      }
    }
    return super.update(id, patch);
  }

  /**
   * Atomically link this document to an observation. Clears any
   * existing `linkedLabValueId` in the same write so the mutual
   * exclusion invariant survives even if the caller is switching
   * between link kinds.
   */
  async linkToObservation(id: string, observationId: string): Promise<Document> {
    return this.update(id, {
      linkedObservationId: observationId,
      linkedLabValueId: undefined,
    });
  }

  /**
   * Atomically link this document to a lab value. Clears any existing
   * `linkedObservationId` in the same write.
   */
  async linkToLabValue(id: string, labValueId: string): Promise<Document> {
    return this.update(id, {
      linkedLabValueId: labValueId,
      linkedObservationId: undefined,
    });
  }

  /** Clear both link fields. Safe on already-unlinked documents. */
  async unlink(id: string): Promise<Document> {
    return this.update(id, {
      linkedObservationId: undefined,
      linkedLabValueId: undefined,
    });
  }

  /**
   * Documents linked to a given observation, scoped to a profile.
   *
   * In-memory filter over `listByProfile` (consistent with the
   * "no plaintext indexes" rule in CLAUDE.md; the per-profile dataset
   * is small enough that a full decrypt-then-filter is the right
   * trade-off vs. adding a secondary encrypted index).
   */
  async listByObservation(profileId: string, observationId: string): Promise<Document[]> {
    const all = await this.listByProfile(profileId);
    return all.filter((d) => d.linkedObservationId === observationId);
  }

  /** Documents linked to a given lab value, scoped to a profile. */
  async listByLabValue(profileId: string, labValueId: string): Promise<Document[]> {
    const all = await this.listByProfile(profileId);
    return all.filter((d) => d.linkedLabValueId === labValueId);
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
