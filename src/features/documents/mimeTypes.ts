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
