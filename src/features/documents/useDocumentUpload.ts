import { useCallback, useState } from 'react';
import {
  DocumentRepository,
  DocumentSizeLimitError,
  DOCUMENT_SIZE_LIMIT_BYTES,
  ProfileRepository,
} from '../../db/repositories';
import type { Document } from '../../domain';
import {
  ACCEPTED_DOCUMENT_TYPES,
  isAcceptedDocumentType,
  type AcceptedDocumentType,
} from './mimeTypes';
import { usePersistentStorage } from './usePersistentStorage';

export { ACCEPTED_DOCUMENT_TYPES, type AcceptedDocumentType };

export type DocumentUploadError =
  | { kind: 'no-profile' }
  | { kind: 'unsupported-type'; mimeType: string }
  | { kind: 'file-too-large'; actualBytes: number; limitBytes: number }
  | { kind: 'read-failed'; detail: string }
  | { kind: 'generic'; detail: string };

export type DocumentUploadStatus =
  | { kind: 'idle' }
  | { kind: 'uploading'; filename: string }
  | { kind: 'success'; document: Document }
  | { kind: 'error'; error: DocumentUploadError };

export interface UseDocumentUploadResult {
  status: DocumentUploadStatus;
  /**
   * Run the upload pipeline. Returns the resolved status so callers
   * that need to react after the await (e.g., bumping a refresh key
   * on the parent list) do not have to read `status` from the
   * captured closure - which is stale by definition because React
   * has not re-rendered yet between the setState inside `upload` and
   * the line after the `await` in the caller.
   */
  upload: (file: File) => Promise<DocumentUploadStatus>;
  reset: () => void;
}

/**
 * Upload-flow state machine for a single document at a time.
 *
 * Validation order:
 *   1. MIME type against `ACCEPTED_DOCUMENT_TYPES`.
 *   2. Size against `DOCUMENT_SIZE_LIMIT_BYTES`.
 *   3. File-read into ArrayBuffer.
 *   4. Encrypt + persist via `DocumentRepository.create`.
 *
 * The repository enforces the size cap as well (defense in depth);
 * the hook short-circuits earlier so the user gets a localized error
 * before file IO happens.
 */
export function useDocumentUpload(): UseDocumentUploadResult {
  const [status, setStatus] = useState<DocumentUploadStatus>({ kind: 'idle' });
  const { requestPersistence } = usePersistentStorage();

  const reset = useCallback(() => {
    setStatus({ kind: 'idle' });
  }, []);

  const upload = useCallback(
    async (file: File): Promise<DocumentUploadStatus> => {
      // Helper: write to local + state and return the same value so
      // every exit path produces a single resolved status the caller
      // can await without re-reading the captured `status` (which is
      // stale until React re-renders).
      const finalize = (next: DocumentUploadStatus): DocumentUploadStatus => {
        setStatus(next);
        return next;
      };

      if (!isAcceptedDocumentType(file.type)) {
        return finalize({
          kind: 'error',
          error: { kind: 'unsupported-type', mimeType: file.type },
        });
      }
      if (file.size > DOCUMENT_SIZE_LIMIT_BYTES) {
        return finalize({
          kind: 'error',
          error: {
            kind: 'file-too-large',
            actualBytes: file.size,
            limitBytes: DOCUMENT_SIZE_LIMIT_BYTES,
          },
        });
      }

      setStatus({ kind: 'uploading', filename: file.name });

      let content: ArrayBuffer;
      try {
        content = await file.arrayBuffer();
      } catch (err) {
        return finalize({
          kind: 'error',
          error: {
            kind: 'read-failed',
            detail: err instanceof Error ? err.message : String(err),
          },
        });
      }

      let profileId: string;
      try {
        const profile = await new ProfileRepository().getCurrentProfile();
        if (!profile) {
          return finalize({ kind: 'error', error: { kind: 'no-profile' } });
        }
        profileId = profile.id;
      } catch (err) {
        return finalize({
          kind: 'error',
          error: {
            kind: 'generic',
            detail: err instanceof Error ? err.message : String(err),
          },
        });
      }

      try {
        const repo = new DocumentRepository();
        const document = await repo.create({
          profileId,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          content,
        });
        // Fire-and-forget: request persistent-storage permission on
        // every upload whose persistence is still transient. Internal
        // session guard in the hook prevents double-calls per page
        // load; awaiting would block upload-success propagation
        // because `persist()` can prompt (Firefox) or take a moment.
        requestPersistence();
        return finalize({ kind: 'success', document });
      } catch (err) {
        if (err instanceof DocumentSizeLimitError) {
          return finalize({
            kind: 'error',
            error: {
              kind: 'file-too-large',
              actualBytes: err.actualBytes,
              limitBytes: err.limitBytes,
            },
          });
        }
        return finalize({
          kind: 'error',
          error: {
            kind: 'generic',
            detail: err instanceof Error ? err.message : String(err),
          },
        });
      }
    },
    [requestPersistence],
  );

  return { status, upload, reset };
}
