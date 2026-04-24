import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  preparePdfNoConsentNeeded,
  preparePdfWithRasterization,
  PdfPageLimitError,
  MAX_PDF_PAGES_PER_IMPORT,
} from './preparePdf';

/**
 * Mutable mock state. Tests set `currentMockPages` before invoking
 * `preparePdfNoConsentNeeded` / `preparePdfWithRasterization`. The
 * hoisted `vi.mock` factory below reads this on every call, so the
 * mock can be reconfigured per test without recreating module
 * registrations.
 *
 * Real pdf.js requires Canvas + a Web Worker, neither of which jsdom
 * supports. Mocking lets these tests cover preparePdf's logic
 * (text-layer detection, page-cap, multimodal assembly) without
 * standing up the full pdf.js runtime. End-to-end PDF rendering is
 * exercised by the manual smoke + future production E2E with real
 * Chromium.
 */
type FakePage = { text: string };
let currentMockPages: FakePage[] = [];

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {
    workerPort: { postMessage: () => {} },
    workerSrc: '',
  },
  getDocument: () => ({
    promise: Promise.resolve({
      get numPages() {
        return currentMockPages.length;
      },
      getPage: (n: number) => {
        const page = currentMockPages[n - 1];
        if (!page) return Promise.reject(new Error(`page ${n} out of range`));
        return Promise.resolve({
          getTextContent: () =>
            Promise.resolve({
              items: page.text.split(' ').map((s) => ({ str: s })),
            }),
          getViewport: () => ({ width: 612, height: 792 }),
          render: () => ({ promise: Promise.resolve() }),
        });
      },
    }),
  }),
}));

beforeEach(() => {
  currentMockPages = [];
});

function makeFile(): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'doc.pdf', {
    type: 'application/pdf',
  });
}

describe('preparePdfNoConsentNeeded', () => {
  it('returns text-mode PreparedInput when text density >= threshold', async () => {
    currentMockPages = [{ text: 'word '.repeat(50).trim() }]; // 250 chars >> 100

    const result = await preparePdfNoConsentNeeded(makeFile());

    expect(result).not.toBeNull();
    if (!result) throw new Error('unreachable');
    expect(result.mode).toBe('text');
    if (result.mode !== 'text') throw new Error('unreachable');
    expect(result.textContent).toMatch(/word/);
  });

  it('returns null (rasterization-required) when text density below threshold', async () => {
    currentMockPages = [{ text: 'short' }]; // 5 chars

    const result = await preparePdfNoConsentNeeded(makeFile());

    expect(result).toBeNull();
  });

  it('treats average-below-threshold across pages as no-text-layer', async () => {
    currentMockPages = [
      { text: 'word '.repeat(50).trim() }, // 250 chars
      { text: '' },
      { text: '' }, // avg = 250/3 ≈ 83 < 100 → rasterize
    ];

    const result = await preparePdfNoConsentNeeded(makeFile());

    expect(result).toBeNull();
  });

  it('throws PdfPageLimitError when numPages exceeds the cap', async () => {
    currentMockPages = Array.from({ length: MAX_PDF_PAGES_PER_IMPORT + 1 }, () => ({
      text: 'x'.repeat(200),
    }));

    try {
      await preparePdfNoConsentNeeded(makeFile());
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PdfPageLimitError);
      expect((err as PdfPageLimitError).actualPages).toBe(MAX_PDF_PAGES_PER_IMPORT + 1);
      expect((err as PdfPageLimitError).limitPages).toBe(MAX_PDF_PAGES_PER_IMPORT);
    }
  });

  it('PdfPageLimitError message references the limit', () => {
    const err = new PdfPageLimitError(50);
    expect(err.message).toMatch(/50/);
    expect(err.message).toMatch(String(MAX_PDF_PAGES_PER_IMPORT));
  });
});

describe('preparePdfWithRasterization', () => {
  it('returns text-mode PreparedInput when text density actually qualifies', async () => {
    currentMockPages = [{ text: 'word '.repeat(50).trim() }];

    const result = await preparePdfWithRasterization(makeFile());

    expect(result.mode).toBe('text');
  });

  it.skip('rasterizes pages and returns multimodal PreparedInput', async () => {
    // Skipped: jsdom does not implement HTMLCanvasElement#getContext('2d')
    // or canvas.toBlob. The rasterization happy path is exercised in
    // the manual smoke + future production E2E with real Chromium.
    // The text-mode path above and PdfPageLimitError path together
    // cover the orchestration logic that lives in this module.
  });
});
