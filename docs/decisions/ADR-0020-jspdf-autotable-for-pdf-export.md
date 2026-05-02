# ADR-0020: jspdf-autotable for PDF Export Tables

## Context

Phase 5 PDF export (X-02 onward) renders the user's profile as a print-
ready PDF for doctor visits. The lab-values section is intrinsically
tabular (parameter, value, unit, reference range, assessment) and must
paginate cleanly across page breaks.

Plain `jsPDF` (already locked, see `.claude/rules/coding-standards.md`)
exposes only low-level primitives: `text()`, `rect()`, manual `y`
cursor management. Implementing column layout, header repetition on
new pages, row striping, and word-wrapping inside a fixed cell width
from these primitives is non-trivial and would duplicate logic that
the `jspdf-autotable` plugin already provides.

### Options considered

- **Option A (manual table layout on top of jsPDF)**: write our own
  paginating renderer in `pdfExport.ts`. Multi-day effort, regression
  risk on every layout edit, no native row-striping or header repeat.
  Rejected.
- **Option B (`jspdf-autotable` plugin)**: official jsPDF companion
  plugin maintained alongside jsPDF, MIT-licensed. Provides exactly
  the primitives needed: `head` / `body` arrays, automatic
  pagination, `finalY` tracking via `doc.lastAutoTable.finalY`, theme
  presets, per-column styles. Bundle delta on top of jsPDF is small.
- **Option C (a different PDF library with built-in tables, e.g.
  `pdfmake`)**: would require swapping out jsPDF too, doubling the
  PDF-stack footprint and discarding the lazy-loading work already
  shipped for jsPDF. Rejected.
- **Option D (HTML-to-PDF via the browser print dialog)**: bypasses
  jsPDF entirely but loses control over pagination, fonts, and
  doctor-visit-optimized section ordering. The X-02 design Q-decision
  explicitly fixed the section order; deferring layout to the browser
  print stack reverses that decision. Rejected.

## Decision

Adopt **`jspdf-autotable`** as a runtime dependency for the lab-values
table in PDF export (X-02) and any future tabular section.

### Loading strategy

- **Dynamic import only.** `import('jspdf-autotable')` co-loaded with
  `import('jspdf')` inside `exportProfileAsPdf()` in
  `src/features/export/pdfExport.ts:111-117`. Never imported at the
  module-graph top level.
- **No top-level side-effect import.** The plugin attaches itself to
  the `jsPDF` prototype on import; we instead consume the default
  export (`autoTableModule.default`) as a free function `autoTable(doc,
opts)` so the plugin code path is contained to the export feature.
- **Bundled, no external resources.** Plugin code ships in the lazy
  `jsPDF chunk` already declared in `.size-limit.json:40` (140 KB
  ceiling). No CDN fetch, no font fetch, no runtime third-party calls
  (Nicht-verhandelbares Prinzip 2).

### Bundle math

`jspdf-autotable` is small relative to `jsPDF` itself (single-digit
KB gzip in the typical setup). Both ship together in the lazy
jsPDF-stack chunk, fetched only on the first PDF export. Main JS is
unaffected. The 140 KB ceiling on the lazy chunk in
`.size-limit.json:40` covers both packages combined.

### Usage scope

- Currently used for the lab-values table only (`pdfExport.ts:304`).
- Other sections (observations, supplements, open points) intentionally
  use list-style layout via plain jsPDF primitives because their data
  is not strictly tabular and free-flow reads better in print.
- Future tabular sections route through the same `AutoTablePlugin`
  type and the existing `JsPdfDoc & { lastAutoTable?: ... }` cursor
  pattern.

## Consequences

### Positive

- Lab-values table paginates correctly across page breaks with
  zero hand-rolled layout code.
- `finalY` cursor restoration after a table is a single property
  read, not a y-coordinate calculation.
- Plugin is maintained by the jsPDF maintainers; version drift is
  coupled to the already-locked `jsPDF` dependency.
- Privacy posture preserved: no CDN, no fonts fetched at runtime.

### Negative

- One additional npm package on the dependency surface. The package
  is contained behind one feature folder (`src/features/export/`) and
  is reversible: removal requires reimplementing the lab-values
  table loop on plain jsPDF primitives.
- The plugin's typing has historically lagged its API; the local
  `AutoTablePlugin` type alias in `pdfExport.ts:109` documents the
  call shape we depend on so a future plugin upgrade surfaces as a
  compile error rather than a silent break.

### Reversibility

If `jspdf-autotable` becomes unmaintained or surfaces a serious
vulnerability, replacement requires rewriting one section of
`pdfExport.ts` (the lab-values table) on raw jsPDF primitives or
swapping in a different table renderer. The lazy import boundary
keeps the change blast-radius small.

## Bundle budget

Lazy chunk slot `jsPDF chunk` in `.size-limit.json:40` covers
`jsPDF + jspdf-autotable` combined: 140 KB gzip ceiling. No
additional size-limit entry is introduced because both packages
co-load.

## References

- X-02 ROADMAP entry (PDF export with date-range filter).
- ADR-0017 (lazy-load pattern for `pdfjs-dist`, mirrored here).
- `.size-limit.json:40` (lazy chunk budget).
