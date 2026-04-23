import { useCallback, useState } from 'react';
import {
  DocumentRepository,
  DocumentSizeLimitError,
  DOCUMENT_SIZE_LIMIT_BYTES,
  ProfileRepository,
} from '../../db/repositories';
import type { Document } from '../../domain';

/**
 * MIME types accepted by the upload component. PDFs and the three
 * widely-supported lossless+lossy image formats. Conservative on
 * purpose: viewer code (D-05/D-06) is built only for these. Adding a
 * new type here means adding viewer support too.
 */
export const ACCEPTED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export type AcceptedDocumentType = (typeof ACCEPTED_DOCUMENT_TYPES)[number];

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
  upload: (file: File) => Promise<void>;
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

  const reset = useCallback(() => {
    setStatus({ kind: 'idle' });
  }, []);

  const upload = useCallback(async (file: File): Promise<void> => {
    if (!isAcceptedType(file.type)) {
      setStatus({
        kind: 'error',
        error: { kind: 'unsupported-type', mimeType: file.type },
      });
      return;
    }
    if (file.size > DOCUMENT_SIZE_LIMIT_BYTES) {
      setStatus({
        kind: 'error',
        error: {
          kind: 'file-too-large',
          actualBytes: file.size,
          limitBytes: DOCUMENT_SIZE_LIMIT_BYTES,
        },
      });
      return;
    }

    setStatus({ kind: 'uploading', filename: file.name });

    let content: ArrayBuffer;
    try {
      content = await file.arrayBuffer();
    } catch (err) {
      setStatus({
        kind: 'error',
        error: {
          kind: 'read-failed',
          detail: err instanceof Error ? err.message : String(err),
        },
      });
      return;
    }

    let profileId: string;
    try {
      const profile = await new ProfileRepository().getCurrentProfile();
      if (!profile) {
        setStatus({ kind: 'error', error: { kind: 'no-profile' } });
        return;
      }
      profileId = profile.id;
    } catch (err) {
      setStatus({
        kind: 'error',
        error: {
          kind: 'generic',
          detail: err instanceof Error ? err.message : String(err),
        },
      });
      return;
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
      setStatus({ kind: 'success', document });
    } catch (err) {
      if (err instanceof DocumentSizeLimitError) {
        setStatus({
          kind: 'error',
          error: {
            kind: 'file-too-large',
            actualBytes: err.actualBytes,
            limitBytes: err.limitBytes,
          },
        });
        return;
      }
      setStatus({
        kind: 'error',
        error: {
          kind: 'generic',
          detail: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }, []);

  return { status, upload, reset };
}

function isAcceptedType(mime: string): mime is AcceptedDocumentType {
  return (ACCEPTED_DOCUMENT_TYPES as readonly string[]).includes(mime);
}
