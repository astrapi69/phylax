import type { PreparedInput, SourceFileMetadata } from './types';

/**
 * Per-page rasterization DPI for text-less PDFs (ADR-0017).
 * 150 DPI keeps body text legible for downstream OCR-class AI
 * without bloating uploads. Tunable here; do not inline elsewhere.
 */
const RASTERIZATION_DPI = 150;

/**
 * Threshold for detecting "no text layer" PDFs (ADR-0017).
 * If extracted text averages fewer than this many characters per
 * page, the PDF is treated as a scan and rasterized for multimodal
 * AI extraction. A 5-page PDF with one watermark string (40 chars
 * total) is functionally a scan; a 10-page lab report with full
 * text yields thousands of chars per page.
 */
const MIN_CHARS_PER_PAGE_FOR_TEXT_MODE = 100;

/**
 * Hard cap on per-PDF page count (ADR-0017). Larger PDFs are
 * rejected with `PdfPageLimitError`. 20 rasterized pages at 150 DPI
 * is already a meaningful AI-cost + latency event; arbitrarily
 * larger imports would surprise users with cost. Future tuning
 * lands here when real usage data motivates a higher limit.
 */
export const MAX_PDF_PAGES_PER_IMPORT = 20;

/** JPEG quality for rasterized page images. 0.85 = good text legibility / size trade. */
const RASTERIZATION_JPEG_QUALITY = 0.85;

/** Base DPI assumed by pdf.js viewports; scale = target / base. */
const PDFJS_BASE_DPI = 72;

/**
 * Thrown when an imported PDF exceeds `MAX_PDF_PAGES_PER_IMPORT`.
 * Caught upstream by the import UI for a localized error message;
 * thrown unconditionally here as defense in depth.
 */
export class PdfPageLimitError extends Error {
  constructor(
    public readonly actualPages: number,
    public readonly limitPages: number = MAX_PDF_PAGES_PER_IMPORT,
  ) {
    super(`PDF exceeds page limit: ${actualPages} pages > ${limitPages}`);
    this.name = 'PdfPageLimitError';
  }
}

/**
 * Result discriminator from `analyzePdf`. Internal to this module;
 * callers see the orchestrator-level `PrepareResult`.
 */
type PdfAnalysis =
  | { kind: 'text-mode'; text: string }
  | { kind: 'rasterization-required'; document: PdfDocumentLike };

/**
 * Subset of pdfjs-dist types this module uses. Avoids leaking the
 * pdfjs-dist type surface into call sites and keeps mocks small.
 */
interface PdfDocumentLike {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
}

interface PdfPageLike {
  getTextContent(): Promise<{ items: Array<{ str?: string }> }>;
  getViewport(params: { scale: number }): { width: number; height: number };
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): { promise: Promise<void> };
}

/**
 * Prepare a PDF file for downstream AI classification.
 *
 * Two paths:
 * - **Text mode**: PDF has a usable text layer. Returns a
 *   `text`-mode `PreparedInput` with the extracted text. No page
 *   images uploaded; cheap.
 * - **Rasterization required**: PDF lacks a text layer (or has too
 *   little text per page — see `MIN_CHARS_PER_PAGE_FOR_TEXT_MODE`).
 *   Returns `null` here; the orchestrator surfaces a
 *   `consent-required` state so the user explicitly accepts the
 *   page-image upload to a multimodal AI provider before
 *   `prepareWithConsent` re-enters and calls `rasterizePdf`.
 *
 * Throws `PdfPageLimitError` if the PDF exceeds the page cap;
 * throws other errors only on unrecoverable parse failures (caller
 * surfaces a generic "unreadable PDF" message).
 */
export async function preparePdfNoConsentNeeded(file: File): Promise<PreparedInput | null> {
  const analysis = await analyzePdf(file);
  if (analysis.kind === 'text-mode') {
    return makeTextPreparedInput(analysis.text, file);
  }
  // Rasterization path — caller orchestrator surfaces consent-required.
  return null;
}

/**
 * Re-entry point after the user grants consent. Performs the
 * rasterization that `preparePdfNoConsentNeeded` deferred, returns
 * a `multimodal`-mode `PreparedInput` carrying per-page JPEG
 * ArrayBuffers + any partial text that was extractable.
 */
export async function preparePdfWithRasterization(file: File): Promise<PreparedInput> {
  const analysis = await analyzePdf(file);
  if (analysis.kind === 'text-mode') {
    // The text-layer threshold may have flipped between calls;
    // honor it by returning text-mode if applicable. Idempotent.
    return makeTextPreparedInput(analysis.text, file);
  }
  const { document } = analysis;
  const partialText = await extractAllText(document);
  const pageImages = await rasterizeAllPages(document);
  return {
    mode: 'multimodal',
    textContent: partialText,
    imageData: pageImages,
    sourceFile: makeSourceFileMetadata(file),
  };
}

async function analyzePdf(file: File): Promise<PdfAnalysis> {
  const buffer = await file.arrayBuffer();
  const document = await loadPdfDocument(buffer);

  if (document.numPages > MAX_PDF_PAGES_PER_IMPORT) {
    throw new PdfPageLimitError(document.numPages);
  }

  const text = await extractAllText(document);
  const avgCharsPerPage = document.numPages === 0 ? 0 : text.length / document.numPages;

  if (avgCharsPerPage >= MIN_CHARS_PER_PAGE_FOR_TEXT_MODE) {
    return { kind: 'text-mode', text };
  }
  return { kind: 'rasterization-required', document };
}

/**
 * Dynamic-import pdf.js with the worker bundled via Vite's
 * `?worker` suffix (per ADR-0017). Top-level static import would
 * pull pdf.js into the main JS bundle — this dynamic boundary is
 * the entire reason main JS stays small.
 */
async function loadPdfDocument(data: ArrayBuffer): Promise<PdfDocumentLike> {
  const pdfjs = await import('pdfjs-dist');
  // The worker is bundled by Vite at build time via the ?worker
  // suffix; dev + prod both produce a same-origin chunk, no CDN
  // fetch. Privacy posture preserved (no runtime third-party
  // network calls). See ADR-0017.
  if (!pdfjs.GlobalWorkerOptions.workerPort && !pdfjs.GlobalWorkerOptions.workerSrc) {
    const PdfWorker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')).default;
    pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();
  }
  const loadingTask = pdfjs.getDocument({
    data,
    // Disable runtime font fetches — Phylax forbids third-party
    // network calls. Worst case: missing-font glyphs render with
    // OS substitutes. Acceptable.
    disableFontFace: true,
    useSystemFonts: false,
  });
  const document = await loadingTask.promise;
  return document as unknown as PdfDocumentLike;
}

async function extractAllText(document: PdfDocumentLike): Promise<string> {
  const parts: string[] = [];
  for (let i = 1; i <= document.numPages; i++) {
    const page = await document.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => item.str ?? '')
      .filter((s) => s.length > 0)
      .join(' ');
    parts.push(pageText);
  }
  return parts.join('\n\n').trim();
}

async function rasterizeAllPages(document: PdfDocumentLike): Promise<ArrayBuffer[]> {
  const images: ArrayBuffer[] = [];
  const scale = RASTERIZATION_DPI / PDFJS_BASE_DPI;
  for (let i = 1; i <= document.numPages; i++) {
    const page = await document.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document_createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context unavailable for PDF rasterization');
    }
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await canvasToJpegBlob(canvas);
    images.push(await blob.arrayBuffer());
  }
  return images;
}

function document_createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = window.document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  return canvas;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('canvas.toBlob returned null'));
      },
      'image/jpeg',
      RASTERIZATION_JPEG_QUALITY,
    );
  });
}

function makeTextPreparedInput(text: string, file: File): PreparedInput {
  return {
    mode: 'text',
    textContent: text,
    sourceFile: makeSourceFileMetadata(file),
  };
}

function makeSourceFileMetadata(file: File): SourceFileMetadata {
  return { name: file.name, type: file.type, size: file.size };
}
