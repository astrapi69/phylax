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
  /**
   * One or more rasterized images. PDF rasterization (IMP-02)
   * produces one entry per page; the array carries page order
   * implicitly via index. Single-image cases use
   * `PreparedInputImage`; this mode is reserved for inputs that
   * combine text with N images (currently only PDF rasterization).
   */
  imageData: ArrayBuffer[];
  sourceFile: SourceFileMetadata;
}

/**
 * Result of `prepare(file)` (IMP-02 onward). Discriminated by
 * `kind`:
 * - `ready`: prepared input is available, no further user action
 *   needed before passing to IMP-03 classification.
 * - `consent-required`: input cannot be prepared without explicit
 *   user consent (currently: PDFs without text layer that need
 *   page-wise rasterization + image upload to a multimodal AI
 *   provider). Caller (IMP-04 UI) renders a consent dialog and
 *   re-enters via `prepareWithConsent(file, options)`.
 *
 * Separation of concerns: `prepare` is the orchestrator;
 * consent UX lives in the UI layer. This contract lets `prepare`
 * be called from non-UI contexts (batch import, tests) without
 * coupling to dialog rendering.
 */
export type PrepareResult =
  | { kind: 'ready'; input: PreparedInput }
  | { kind: 'consent-required'; reason: ConsentRequiredReason; file: File };

export type ConsentRequiredReason = 'pdf-rasterization';

/**
 * Result of `prepareWithConsent(file, options)` after a
 * `consent-required` round trip.
 */
export type PrepareWithConsentResult =
  | { kind: 'ready'; input: PreparedInput }
  | { kind: 'consent-declined' };

export interface PrepareWithConsentOptions {
  /**
   * When true, the per-file consent decision is remembered in
   * module-level session state so subsequent imports of the same
   * `reason` proceed without re-prompting until page reload.
   * Default false: consent is per-file unless the user explicitly
   * opts in via the dialog checkbox.
   */
  rememberForSession?: boolean;
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
