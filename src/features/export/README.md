# src/features/export

PDF and CSV export UI. Generates reports for doctor visits with date range and type filters.

Uses jsPDF for PDF generation. Reports include a header, patient info section (user-editable), and entries grouped by type. CSV export produces one file per entry type. All exports use the naming convention `phylax-report-YYYY-MM-DD`.

## What does NOT belong here

- No direct `crypto.subtle` calls. Decrypted data comes from repositories.
- No Dexie imports. Data access goes through repositories.
- No jsPDF logic mixed into components. PDF generation belongs in a dedicated service.

## Planned contents

- `PdfReport.tsx` (X-01): PDF report generation orchestrator
- `DateRangeSelector.tsx` (X-02): date range picker for report scope
- `TypeFilter.tsx` (X-03): entry type selection for the report
- `CsvExport.tsx` (X-05): CSV export per entry type
- `ExportPreview.tsx` (X-06): preview before download
- `index.ts`: public API re-exports
