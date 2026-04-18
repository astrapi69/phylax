# src/features/export

Profile export in Markdown, PDF, and CSV formats. Users trigger exports
from the Profile view or the Settings screen; the dialog owns the format
choice; each export is client-side only (no server, no network).

## Boundaries

- No direct `crypto.subtle` calls. Decrypted data arrives via
  repositories through `useExportData`.
- No Dexie imports. Data access goes through repositories.
- No PDF / Markdown / CSV formatting inside React components. Pure
  format functions (`markdownExport.ts` and future `pdfExport.ts` /
  `csvExport.ts`) produce strings or Blobs; components only trigger the
  download.

## Current contents

- `markdownExport.ts` (X-01): pure `(profile, entities, options) => string`
  in the "Lebende Gesundheit" format, round-trip compatible with the
  IM-01 parser.
- `download.ts`: `triggerDownload(content, filename, mimeType)` Blob +
  anchor click helper, reused by every export format.
- `filenames.ts`: `phylax-profil-YYYY-MM-DD.{md,pdf}` and
  `phylax-labor-YYYY-MM-DD.csv` generators.
- `exportOptions.ts`: shared `ExportOptions` type (date range, theme
  filter, linked documents). Accepted by every export function so filter
  UIs land in X-03 / X-04 / X-05 without refactoring the contract.
- `useExportData.ts`: one hook that loads the current profile plus all
  entity lists via repositories; returns a typed Result.
- `ExportDialog.tsx`: format-choice modal. X-01 renders the Markdown
  button only; PDF (X-02) and CSV (X-06) buttons appear once those
  tasks ship.
- `ExportButton.tsx`: entry-point button that opens the dialog. Mounted
  prominently in the Profile view and as a subtle link in Settings.

## Planned

- `pdfExport.ts` (X-02a): basic `jsPDF` profile report
- `csvExport.ts` (X-06): lab-values-only CSV
- Filter UIs (X-03 date range, X-04 theme)
- Preview dialog (X-07) applies to all three formats
- Linked-documents appendix (X-05 / X-02b)
