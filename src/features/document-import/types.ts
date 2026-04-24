/**
 * Type contracts for the document-import pipeline (Phase 4b IMP-series).
 *
 * IMP-01 ships these types + a working `text/plain` / `text/markdown`
 * import path. IMP-02 fills in PDF and image branches against the
 * same `PreparedInput` contract. IMP-03 consumes `PreparedInput` to
 * produce `DocumentClassification` + extracted entries via the
 * Phase 3 multimodal AI providers.
 *
 * Naming note: this folder is `document-import/`, distinct from
 * `profile-import/` (IM-series, markdown profile parser). Two
 * different domains: profile-import parses a single living-health
 * markdown document; document-import handles arbitrary medical
 * documents (PDFs, images, text notes) and routes them through AI
 * classification + extraction.
 */

/**
 * Source-file metadata carried alongside every prepared input so
 * downstream stages (classifier, extractor, link-back to D-04
 * documents row) can reference the original without re-reading the
 * `File`.
 */
export interface SourceFileMetadata {
  /** Original filename, e.g. `lab-result-2026-04.pdf`. */
  name: string;
  /** Source MIME type as detected by the browser at upload time. */
  type: string;
  /** Decoded byte length (post-text-decode for text inputs, raw for binary). */
  size: number;
}

/**
 * Output of `prepare(file)`. Discriminated by `mode`:
 * - `text`: AI receives plain text only. Used for `.txt` / `.md` notes
 *   and for PDFs whose text layer was extracted locally (IMP-02).
 * - `image`: AI receives binary image data only. Used for raster
 *   uploads (PNG / JPEG / WebP) where there is no text to extract
 *   client-side (IMP-02).
 * - `multimodal`: AI receives both. Used for PDFs without a text
 *   layer that get rasterized page-wise alongside any partial text
 *   extraction (IMP-02).
 *
 * Discriminated union (not flat-with-optionals) so downstream
 * consumers narrow on `mode` and get type-checked field access.
 */
export type PreparedInput = PreparedInputText | PreparedInputImage | PreparedInputMultimodal;

export interface PreparedInputText {
  mode: 'text';
  textContent: string;
  sourceFile: SourceFileMetadata;
}

export interface PreparedInputImage {
  mode: 'image';
  imageData: ArrayBuffer;
  sourceFile: SourceFileMetadata;
}

export interface PreparedInputMultimodal {
  mode: 'multimodal';
  textContent: string;
  imageData: ArrayBuffer;
  sourceFile: SourceFileMetadata;
}

/**
 * Document classes the AI classifier (IMP-03) routes into. String
 * literal union, not a TypeScript enum — lighter, tree-shakeable,
 * no import overhead at consumption sites. Adding a new class is a
 * one-line edit here plus extractor + prompt entries in IMP-03 /
 * IMP-06.
 */
export type DocumentType =
  | 'lab-report'
  | 'doctor-letter'
  | 'prescription'
  | 'imaging-report'
  | 'insurer-app-export'
  | 'generic-medical-document';

/**
 * Result of `classify(input)` (IMP-03). Confidence is optional
 * because not every classifier path produces a meaningful score
 * (e.g. user-supplied hint, rule-based shortcut for known formats).
 */
export interface DocumentClassification {
  type: DocumentType;
  confidence?: number;
}
