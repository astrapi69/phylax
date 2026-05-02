import { DOCUMENT_SIZE_LIMIT_BYTES, DocumentSizeLimitError } from '../../db/repositories';
import {
  isImageMimeType,
  isPdfMimeType,
  isTextMimeType,
  isHeicHeifMimeType,
} from '../documents/mimeTypes';
import type {
  PreparedInput,
  PrepareResult,
  PrepareWithConsentResult,
  PrepareWithConsentOptions,
  SourceFileMetadata,
} from './types';
import { preparePdfNoConsentNeeded, preparePdfWithRasterization } from './preparePdf';
import { prepareImage } from './prepareImage';
import { isConsentGranted, grantConsentForSession } from './consent';

/**
 * Thrown when `prepare(file)` receives a MIME type that no
 * import-source handler is wired up for. After IMP-02 the supported
 * set covers text/markdown, PDF, PNG/JPEG/WebP. Anything else (e.g.
 * application/octet-stream, video/*) surfaces this error.
 *
 * HEIC / HEIF have a dedicated error class with targeted localized
 * message - see `HeicHeifNotSupportedError`.
 */
export class UnsupportedSourceError extends Error {
  constructor(public readonly mimeType: string) {
    super(`Import source MIME type not supported: ${mimeType}`);
    this.name = 'UnsupportedSourceError';
  }
}

/**
 * Thrown when the user uploads a HEIC or HEIF file. Distinct from
 * `UnsupportedSourceError` so the UI can render targeted guidance
 * ("Convert to JPEG before upload - your iOS share-sheet does this
 * automatically in most apps") rather than the generic unsupported
 * message. Per ADR-0017 + IMP-02 design rationale: bundling
 * `heic2any` (~100 KB) for an edge case where iOS auto-converts is
 * poor ROI; rejection with clear guidance is the chosen path.
 */
export class HeicHeifNotSupportedError extends Error {
  constructor(public readonly mimeType: string) {
    super(`HEIC / HEIF not supported: ${mimeType}. Convert to JPEG before upload.`);
    this.name = 'HeicHeifNotSupportedError';
  }
}

/**
 * Convert a user-supplied `File` into a `PrepareResult`.
 *
 * Validation order:
 *   1. Size cap against `DOCUMENT_SIZE_LIMIT_BYTES` (10 MB) - fail
 *      fast before any read or decode work happens. Defense in depth
 *      next to `DocumentRepository.create` which also enforces the
 *      cap; the repo gate would catch oversized files only after a
 *      wasted encrypt round-trip.
 *   2. MIME dispatch via `switch`-style branches:
 *      - text/plain | text/markdown  -> text-mode PreparedInput
 *      - PDF (with text layer)       -> text-mode PreparedInput
 *      - PDF (no text layer)         -> consent-required (caller UI
 *                                       renders dialog, re-enters via
 *                                       `prepareWithConsent`)
 *      - PNG | JPEG | WebP           -> image-mode PreparedInput
 *      - HEIC | HEIF                 -> HeicHeifNotSupportedError
 *      - other                       -> UnsupportedSourceError
 *
 * No registry. Per IMP-01 Path-A: a `switch`-style chain extends
 * with new branches; abstraction layer emerges only when real
 * plugin pressure surfaces. Five branches today, still fine.
 */
export async function prepare(file: File): Promise<PrepareResult> {
  if (file.size > DOCUMENT_SIZE_LIMIT_BYTES) {
    throw new DocumentSizeLimitError(file.size);
  }

  if (isHeicHeifMimeType(file.type)) {
    throw new HeicHeifNotSupportedError(file.type);
  }

  if (isTextMimeType(file.type)) {
    return { kind: 'ready', input: prepareTextSync(await file.arrayBuffer(), file) };
  }

  if (isPdfMimeType(file.type)) {
    const ready = await preparePdfNoConsentNeeded(file);
    if (ready) {
      return { kind: 'ready', input: ready };
    }
    // PDF needs rasterization. If the user already granted consent
    // for this session via a prior `prepareWithConsent` call with
    // `rememberForSession: true`, skip the dialog and rasterize now.
    if (isConsentGranted('pdf-rasterization')) {
      const input = await preparePdfWithRasterization(file);
      return { kind: 'ready', input };
    }
    return { kind: 'consent-required', reason: 'pdf-rasterization', file };
  }

  if (isImageMimeType(file.type)) {
    const input = await prepareImage(file);
    return { kind: 'ready', input };
  }

  throw new UnsupportedSourceError(file.type);
}

/**
 * Re-entry after a `consent-required` round trip from `prepare`.
 * Caller (IMP-04 UI) renders the consent dialog, captures the
 * user's decision (accept / decline) and the session-remember
 * checkbox, then calls this function with the original `File`.
 *
 * Currently only handles `pdf-rasterization` (the sole reason for
 * consent in IMP-02). Future reasons (e.g. video upload to AI)
 * would extend the switch.
 */
export async function prepareWithConsent(
  file: File,
  options: PrepareWithConsentOptions = {},
): Promise<PrepareWithConsentResult> {
  if (options.rememberForSession) {
    grantConsentForSession('pdf-rasterization');
  }
  if (!isPdfMimeType(file.type)) {
    // Defensive: caller passed a non-PDF after a consent dialog.
    // Re-route through `prepare` to handle any non-PDF MIME.
    const result = await prepare(file);
    if (result.kind === 'ready') return { kind: 'ready', input: result.input };
    return { kind: 'consent-declined' };
  }
  const input = await preparePdfWithRasterization(file);
  return { kind: 'ready', input };
}

function prepareTextSync(buffer: ArrayBuffer, file: File): PreparedInput {
  // Decode via arrayBuffer + TextDecoder rather than `file.text()`.
  // The arrayBuffer path is already polyfilled in jsdom for the
  // documents-feature tests (D-02), so reusing it keeps test setup
  // consistent and avoids a second per-prototype polyfill.
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
