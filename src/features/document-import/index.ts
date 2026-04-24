export {
  prepare,
  prepareWithConsent,
  UnsupportedSourceError,
  HeicHeifNotSupportedError,
} from './prepare';
export {
  MAX_PDF_PAGES_PER_IMPORT,
  PdfPageLimitError,
  preparePdfNoConsentNeeded,
  preparePdfWithRasterization,
} from './preparePdf';
export { MAX_IMAGE_EDGE_PX, ImageDimensionLimitError, prepareImage } from './prepareImage';
export { isConsentGranted, grantConsentForSession, __resetConsentSession } from './consent';
export {
  classifyDocument,
  CLASSIFICATION_MODEL,
  MIN_CLASSIFICATION_CONFIDENCE,
  buildContentBlocks,
} from './classify';
export type { ClassifyOptions, ClassifyResult } from './classify';
export {
  extractEntries,
  extractObservations,
  extractLabValues,
  extractSupplements,
  extractOpenPoints,
  EXTRACTION_MODEL,
  EMPTY_DRAFTS,
} from './extract';
export type { ExtractOptions } from './extract';
export {
  AiCallError,
  type AiCallErrorKind,
  isRetryableAiCallError,
  withRetry,
} from './aiCallError';
export type {
  PreparedInput,
  PreparedInputText,
  PreparedInputImage,
  PreparedInputMultimodal,
  SourceFileMetadata,
  DocumentType,
  DocumentClassification,
  PrepareResult,
  PrepareWithConsentResult,
  PrepareWithConsentOptions,
  ConsentRequiredReason,
} from './types';
export type {
  ObservationDraft,
  LabValueDraft,
  SupplementDraft,
  OpenPointDraft,
  ExtractedDrafts,
  LabReportMeta,
} from './drafts';
export type { LabValuesExtractionResult } from './extract';
export {
  commitDrafts,
  isSelectionEmpty,
  totalCommitted,
  type CommitOptions,
  type CommitResult,
  type CommitTypeResult,
  type DraftSelection,
} from './commit';
