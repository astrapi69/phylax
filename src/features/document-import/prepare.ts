import { DOCUMENT_SIZE_LIMIT_BYTES, DocumentSizeLimitError } from '../../db/repositories';
import { isTextMimeType } from '../documents/mimeTypes';
import type { PreparedInput, SourceFileMetadata } from './types';

/**
 * Thrown when `prepare(file)` receives a MIME type that no
 * import-source handler is wired up for yet. IMP-01 only handles
 * `text/plain` and `text/markdown`; PDFs and images surface this
 * error until IMP-02 lands.
 */
export class UnsupportedSourceError extends Error {
  constructor(public readonly mimeType: string) {
    super(`Import source MIME type not supported yet: ${mimeType}`);
    this.name = 'UnsupportedSourceError';
  }
}

/**
 * Convert a user-supplied `File` into a `PreparedInput` that the
 * downstream classifier (IMP-03) can consume.
 *
 * Validation order:
 *   1. Size cap against `DOCUMENT_SIZE_LIMIT_BYTES` (10 MB) — fail
 *      fast before any read or decode work happens. Defense in depth
 *      next to `DocumentRepository.create` which also enforces the
 *      cap; the repo gate would catch oversized files only after a
 *      wasted encrypt round-trip.
 *   2. MIME dispatch via `switch (file.type)` — explicit branches
 *      per supported MIME, default throws `UnsupportedSourceError`.
 *
 * No registry, no provider abstraction. Phylax's house style is
 * concrete-first: when IMP-02 adds five more branches, this stays
 * a `switch` until a real abstraction need surfaces.
 */
export async function prepare(file: File): Promise<PreparedInput> {
  if (file.size > DOCUMENT_SIZE_LIMIT_BYTES) {
    throw new DocumentSizeLimitError(file.size);
  }

  if (isTextMimeType(file.type)) {
    return prepareText(file);
  }

  throw new UnsupportedSourceError(file.type);
}

async function prepareText(file: File): Promise<PreparedInput> {
  // Decode via arrayBuffer + TextDecoder rather than `file.text()`.
  // The arrayBuffer path is already polyfilled in jsdom for the
  // documents-feature tests (D-02), so reusing it keeps test setup
  // consistent and avoids a second per-prototype polyfill.
  const buffer = await file.arrayBuffer();
  const textContent = new TextDecoder('utf-8').decode(buffer);
  const sourceFile: SourceFileMetadata = {
    name: file.name,
    type: file.type,
    size: file.size,
  };
  return {
    mode: 'text',
    textContent,
    sourceFile,
  };
}
