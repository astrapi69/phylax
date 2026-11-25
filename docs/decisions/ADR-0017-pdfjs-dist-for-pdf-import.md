# ADR-0017: pdfjs-dist for PDF Import

**Date:** 2026-04-24
**Status:** Accepted

## Context

Phase 4b (ePA Import) needs to extract text from user-uploaded PDFs and
rasterize text-less PDFs to images for multimodal-AI extraction. The
upload format is dominated by PDFs in the German healthcare flow:
insurer-app exports (Krankenkassen-App), lab reports, doctor letters,
imaging reports.

A PDF without a text layer (a scanned doctor letter, a phone-photo
saved as PDF) cannot be text-extracted client-side; it must be
rasterized page by page and sent to a multimodal AI provider as image
content. A PDF with a text layer should be extracted locally and sent
as text - cheaper, faster, and keeps the original image data on
device.

No existing dependency in Befaro can read PDFs.

### Options considered

- **Option A (no client-side PDF support)**: reject PDFs entirely,
  require user to extract text or screenshot pages first. Unacceptable
  UX - users cannot reasonably preprocess every doctor's PDF.
- **Option B (pdfjs-dist, Mozilla)**: canonical PDF rendering library
  for browsers. Includes text extraction + page rendering. Active
  maintenance, MIT-licensed. ~250 KB gzip estimated.
- **Option C (a different PDF library, e.g. pdf-lib)**: pdf-lib
  focuses on PDF generation/editing, not text extraction +
  rasterization. Wrong tool for the job.
- **Option D (server-side extraction)**: violates the no-backend
  principle (Nicht-verhandelbares Prinzip 1).

## Decision

Adopt **`pdfjs-dist`** as a runtime dependency for the
document-import pipeline (Phase 4b IMP-02 onward).

### Loading strategy

- **Dynamic import only.** `import('pdfjs-dist')` inside the PDF
  handler in `src/features/document-import/preparePdf.ts`. Never
  imported at the module-graph top level. Result: pdf.js code emits
  as a separate Vite chunk, fetched only when a user actually
  imports a PDF. Main JS bundle gets a near-zero delta from this
  dependency.
- **Worker bundled, not CDN.** Vite `?worker` suffix. The pdf.js
  worker JavaScript ships as a separate chunk in `dist/assets/`,
  precached by the service worker. **No external CDN fetch at
  runtime.** Befaro's privacy posture (Nicht-verhandelbares Prinzip 2) forbids runtime third-party network calls; a CDN fetch for the
  worker would violate this. Bundling is the only acceptable path.
- **No external resources.** pdf.js can fetch fonts from the web by
  default. Disabled via `disableFontFace: true` and `useSystemFonts:
false` (or the equivalent v5 options) so PDFs render only with
  embedded fonts and the local OS font fallback. Worst case: a PDF
  with a missing font renders with substitute glyphs. Acceptable.

### Bundle math

Estimated: ~250 KB gzip for `pdfjs-dist` core + worker chunk. Loaded
lazily on first PDF import. Main JS unaffected (target: <1 KB delta
on the orchestrator extension itself).

`.size-limit.json` gets a new entry for the dynamic chunk so future
pdf.js minor bumps that exceed the budget surface in CI.

Pre-IMP-02 main JS baseline: 237.52 KB (post-Reset feature). Budget
ceiling: 350 KB. Headroom: 112 KB. The dynamic-only loading strategy
preserves this headroom for other features.

### Per-page rasterization at 150 DPI

When a PDF lacks a text layer (or has insufficient text per page -
see threshold below), pdf.js renders each page to a `<canvas>` at
**150 DPI** (constant `RASTERIZATION_DPI` in `preparePdf.ts`). The
canvas is then converted to a JPEG ArrayBuffer for inclusion in the
multimodal `PreparedInput`.

DPI rationale: 150 DPI keeps body text legible for OCR-class AI
without bloating uploads. 96 DPI loses small print on lab reports;
300 DPI doubles file size for marginal gain. Single-resolution
constant; no user-facing control (YAGNI).

### Text-layer detection threshold

A PDF is treated as "no text layer" (and rasterized) when the
extracted text yields **fewer than 100 characters per page on
average**. A 5-page PDF needs >500 total extracted characters to be
treated as text-mode; otherwise rasterize.

Threshold rationale: a one-page PDF with a single watermark string
(40 chars) extracts cleanly but is functionally a scan - rasterize
it. A 10-page lab report with full text layers extracts thousands of
characters per page - text mode. The 100-chars-per-page boundary is
a reasonable default that handles the common edge case (mixed-page
PDFs); future tuning lands on the named constant
`MIN_CHARS_PER_PAGE_FOR_TEXT_MODE` in `preparePdf.ts`.

### Page cap

Hard cap **20 pages per PDF**. Larger PDFs surface
`PdfPageLimitError` with localized message. User splits the PDF
manually if more pages are needed.

Rationale: 20 rasterized pages at 150 DPI uploaded to a multimodal
provider is already a meaningful cost + latency event. A
200-page PDF would be expensive and slow. Hard cap at the prepare
layer prevents accidental large-doc uploads. Constant
`MAX_PDF_PAGES_PER_IMPORT` in `preparePdf.ts`. Future tuning lands
there if real usage data motivates a higher limit.

## Consequences

### Positive

- Text-layer PDFs (~70% of typical medical documents) are extracted
  client-side with no AI image-token cost.
- Rasterization path covers the remaining ~30% (scans, photos saved
  as PDF) without losing the import flow.
- Bundle stays clean: main JS impact is the orchestrator extension
  only, pdf.js loads on demand.
- Privacy posture preserved: no CDN fetches, no font fetches.

### Negative

- Net-new ~250 KB gzip of dependency code (lazy chunk, not main
  bundle).
- pdf.js's worker setup adds Vite-config complexity. Documented
  inline in the worker import.
- PDFs with malformed text layers may yield false negatives on the
  text detection heuristic (treated as scans). Mitigation: the
  consent flow (per-file with session-checkbox opt-in) means the
  user sees what's about to happen and can cancel.
- 20-page cap excludes long PDFs. Documented in localized error;
  user-actionable workaround (split the PDF).

### Reversibility

If pdf.js becomes unmaintained or surfaces a serious vulnerability,
the dependency is contained behind one feature folder
(`src/features/document-import/preparePdf.ts`). Replacement requires
swapping that single module's implementation.

## Update 2026-11-25: pdf.js 6 (DEPS-06)

### Context

GitHub advisory GHSA-hq66-cqwq-w95j (CVE-2026-16633, severity high,
published 2026-08-06) covers `pdfjs-dist` from 5.6.83 up to, not
including, 6.2.108: a malicious PDF can run script in the hosting
origin when `enableScripting` is on and no CSP forbids it. No 5.x
release carries the fix. Befaro was on 5.7.284.

Befaro calls only `getDocument`, `getTextContent` and `page.render`
and builds no annotation layer; in 5.7.284 `enableScripting` is read by
the annotation layer and the viewer only. That makes it likely that the
vulnerable path was never reached, but it was not proven, and an
imported PDF is exactly the untrusted input the advisory describes.

### Decision

- `pdfjs-dist` goes to 6.4.299, declared as `~6.4.299`.
- The supported Safari minimum goes from 16 to 18. PDF.js 6.0 requires
  Chrome 125 and Safari 18 (mozilla/pdf.js pull request 21152: it
  needs `AbortSignal.any()` and drops the polyfills). The maintainer
  decided this on 2026-11-25. `docs/browser-support.md` and
  `.claude/rules/quality-checks.md` carry the new baseline.

### Why 6.4.299 and a tilde range

Measured on 2026-11-25, gzip -9 of the built lazy chunk
`dist/assets/pdf-*.js`: 6.2.108 125,450 bytes, 6.3.289 127,061,
6.4.299 127,372. With 6.5.438 size-limit reports 132.1 kB against the
130 kB budget of the pdf.js slot. 6.4.299 is the newest release inside
the budget. A caret range would let a fresh install resolve to 6.5 and
break the budget, so the range is a tilde. Moving to 6.5 or later needs
a decision on that budget first.

### What changes for the code

Nothing. The two API breaks of 6.0 do not touch Befaro: `getDocument`
is always called with a parameter object, and
`PDFDocumentProxy.destroy` is not used. The worker is still bundled
through Vite and no external resource is fetched
(`scripts/audit-external-resources.mjs` passes).

### What could not be verified automatically

The rasterization path (`page.render` to a canvas) runs in no unit test
(jsdom has no canvas) and in no E2E test. It needs one manual import of
a scanned PDF before the release.

## Related ADRs

- [ADR-0020](ADR-0020-jspdf-autotable-for-pdf-export.md): companion
  decision for PDF export. The lazy-load pattern adopted here is
  mirrored on the export side.
- [ADR-0010](ADR-0010-bundle-size-budgets.md) /
  [ADR-0015](ADR-0015-bundle-budget-expansion.md): bundle-budget
  framework that the dedicated pdf.js lazy-chunk slot fits into.
