/**
 * Shared MIME-type constants for the documents feature.
 *
 * The upload gate (D-02) and the viewer dispatcher (D-05 for PDFs,
 * D-06 for images) must agree on the accepted set. A single source
 * of truth prevents drift: if a new type is ever added here, both
 * the upload whitelist AND the viewer dispatcher get the update for
 * free.
 *
 * Why an explicit whitelist instead of an `image/*` prefix match:
 * defense in depth. `image/svg+xml` can carry executable script and
 * must NOT be treated the same as a raster image. Any future image
 * type gets a deliberate decision here, not implicit acceptance.
 */

export const PDF_MIME_TYPE = 'application/pdf' as const;
export type PdfMimeType = typeof PDF_MIME_TYPE;

export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

export const ACCEPTED_DOCUMENT_TYPES = [PDF_MIME_TYPE, ...IMAGE_MIME_TYPES] as const;
export type AcceptedDocumentType = (typeof ACCEPTED_DOCUMENT_TYPES)[number];

export function isPdfMimeType(mime: string): mime is PdfMimeType {
  return mime === PDF_MIME_TYPE;
}

export function isImageMimeType(mime: string): mime is ImageMimeType {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}

export function isAcceptedDocumentType(mime: string): mime is AcceptedDocumentType {
  return (ACCEPTED_DOCUMENT_TYPES as readonly string[]).includes(mime);
}

/**
 * Plain-text MIME types accepted by the document-import pipeline
 * (Phase 4b IMP-series). These are NOT in `ACCEPTED_DOCUMENT_TYPES`
 * because the documents-feature upload UI (D-02) intentionally
 * restricts to PDF + raster images. Text imports flow through a
 * separate path (no encrypted blob storage; routed straight to
 * AI extraction once IMP-03 lands).
 */
export const TEXT_MIME_TYPE = 'text/plain' as const;
export const MARKDOWN_MIME_TYPE = 'text/markdown' as const;
export const TEXT_MIME_TYPES = [TEXT_MIME_TYPE, MARKDOWN_MIME_TYPE] as const;
export type TextMimeType = (typeof TEXT_MIME_TYPES)[number];

export function isTextMimeType(mime: string): mime is TextMimeType {
  return (TEXT_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * HEIC / HEIF MIME types. Recognized for purposes of producing a
 * specific localized error message during import (instead of the
 * generic "unsupported file type"), but NOT in the accepted set -
 * Phylax does not bundle a HEIC decoder (per ADR-0017 and the IMP-02
 * decision rationale: ~100 KB lazy chunk for an edge case where the
 * iOS share-sheet auto-converts to JPEG anyway). Users who manually
 * upload `.heic` files see the targeted error and can re-export as
 * JPEG.
 */
export const HEIC_MIME_TYPE = 'image/heic' as const;
export const HEIF_MIME_TYPE = 'image/heif' as const;
export const HEIC_HEIF_MIME_TYPES = [HEIC_MIME_TYPE, HEIF_MIME_TYPE] as const;
export type HeicHeifMimeType = (typeof HEIC_HEIF_MIME_TYPES)[number];

export function isHeicHeifMimeType(mime: string): mime is HeicHeifMimeType {
  return (HEIC_HEIF_MIME_TYPES as readonly string[]).includes(mime);
}
