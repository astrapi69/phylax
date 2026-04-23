import type { DomainEntity } from '../../db/repositories/encryptedRepository';

/**
 * An uploaded document (PDF, image, etc.) attached to a profile.
 *
 * Storage model (Phase 4, D-01 onward):
 *
 * - Metadata (this interface) lives in the `documents` Dexie table via
 *   the standard `EncryptedRepository` JSON-encrypt-then-AES pipeline.
 *   Reads of metadata are cheap and fit the list-view access pattern.
 * - The binary content lives in a separate `document_blobs` table,
 *   keyed by the same `id`, handled by a dedicated blob-aware
 *   encryption path (D-03). Separating content from metadata keeps
 *   list-view reads from pulling the whole ArrayBuffer into memory.
 *
 * Invariant: every `Document` metadata row has exactly one matching
 * row in `document_blobs` and vice versa. The repository enforces the
 * pair via Dexie transactions.
 *
 * `createdAt` (from DomainEntity) doubles as the upload timestamp;
 * there is no separate `uploadedAt`.
 */
export interface Document extends DomainEntity {
  /** Original filename as provided by the upload component. */
  filename: string;

  /** MIME type detected at upload, e.g. `application/pdf`, `image/png`. */
  mimeType: string;

  /** Decrypted blob size in bytes. Used for list-view size display and
   *  for the 10 MB per-file cap enforced by the repository. */
  sizeBytes: number;

  /** Optional free-text description entered by the user. */
  description?: string;

  /**
   * Optional link to an Observation. Rendered as "attached to" in the
   * observation detail view. No foreign-key integrity; stale links are
   * cleaned up at delete time (D-08).
   */
  linkedObservationId?: string;

  /**
   * Optional link to a LabValue. Same cleanup behavior as
   * `linkedObservationId`.
   */
  linkedLabValueId?: string;
}
