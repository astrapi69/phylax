import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DateRangeFilter } from '../../ui';
import { exportLabValuesAsCsv } from './csvExport';
import { exportProfileAsMarkdown } from './markdownExport';
import { triggerDownload } from './download';
import type { ExportOptions } from './exportOptions';
import { generateCsvFilename, generateMarkdownFilename, generatePdfFilename } from './filenames';
import { useExportData } from './useExportData';
import { useThemes } from './useThemes';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

type ExportStatus = { kind: 'idle' } | { kind: 'working' } | { kind: 'error'; message: string };

/**
 * Format-choice dialog for profile export. X-01 only renders the Markdown
 * option; PDF (X-02) and CSV (X-06) buttons appear once those tasks land.
 * The dialog owns the data load + download trigger so the button
 * component stays a simple opener.
 */
export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const { t, i18n } = useTranslation('export');
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ExportStatus>({ kind: 'idle' });
  const { loadExportData } = useExportData();

  // X-03 date-range filter. ISO strings in dialog state; converted to
  // Date objects only at the export boundary so the dialog UI matches
  // the O-18 `<DateRangeFilter>` semantic. Both bounds are optional;
  // empty inputs mean "no bound on that side". Dialog returns null
  // while closed (see below), so React's natural lifecycle resets
  // these on dialog close — no explicit clearing logic.
  const [fromIso, setFromIso] = useState('');
  const [toIso, setToIso] = useState('');
  // X-04 theme filter. Themes load on dialog mount via `useThemes`
  // (concern-separated from useExportData). Default state: all themes
  // selected. Empty selection is treated as no-filter to match the
  // existing `filterByThemes` contract across markdown and PDF -
  // diverging would create a per-format surprise.
  const { themes: availableThemes } = useThemes();
  const [excludedThemes, setExcludedThemes] = useState<readonly string[]>([]);
  // X-05 linked-documents appendix opt-in. Independent of dateRange +
  // themes filters by design (helper text under the checkbox, code
  // comment in `appendix.ts`). Default: unchecked.
  const [includeLinkedDocuments, setIncludeLinkedDocuments] = useState(false);
  const toggleTheme = (theme: string) => {
    setExcludedThemes((prev) =>
      prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme],
    );
  };
  const selectedThemes = useMemo(
    () => availableThemes.filter((t) => !excludedThemes.includes(t)),
    [availableThemes, excludedThemes],
  );

  const exportOptions = useMemo<ExportOptions>(() => {
    const opts: ExportOptions = {};
    if (fromIso !== '' || toIso !== '') {
      const dateRange: ExportOptions['dateRange'] = {};
      if (fromIso !== '') {
        // Lower bound: start-of-day UTC so a `from` date includes that
        // entire day's observations / lab reports.
        const ms = Date.parse(`${fromIso}T00:00:00.000Z`);
        if (!Number.isNaN(ms)) dateRange.from = new Date(ms);
      }
      if (toIso !== '') {
        // Upper bound: end-of-day UTC so a `to` date includes that day.
        const ms = Date.parse(`${toIso}T23:59:59.999Z`);
        if (!Number.isNaN(ms)) dateRange.to = new Date(ms);
      }
      if (dateRange.from !== undefined || dateRange.to !== undefined) {
        opts.dateRange = dateRange;
      }
    }
    // Pass `themes` only when user has actively excluded at least one.
    // Per Q3 lock, empty selection is treated as no filter - so we only
    // populate the option when the selection is a strict subset.
    if (
      availableThemes.length > 0 &&
      excludedThemes.length > 0 &&
      selectedThemes.length > 0
    ) {
      opts.themes = selectedThemes;
    }
    if (includeLinkedDocuments) {
      opts.includeLinkedDocuments = true;
    }
    return opts;
  }, [
    fromIso,
    toIso,
    availableThemes,
    excludedThemes,
    selectedThemes,
    includeLinkedDocuments,
  ]);

  useEffect(() => {
    if (open) {
      setStatus({ kind: 'idle' });
      closeRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  async function handleMarkdownExport(): Promise<void> {
    setStatus({ kind: 'working' });
    const result = await loadExportData();
    if (result.kind === 'no-profile') {
      setStatus({ kind: 'error', message: t('error.no-profile') });
      return;
    }
    if (result.kind === 'locked') {
      setStatus({ kind: 'error', message: t('error.locked') });
      return;
    }
    if (result.kind === 'error') {
      setStatus({
        kind: 'error',
        message: t('error.load-failed', { detail: result.message }),
      });
      return;
    }
    const {
      profile,
      observations,
      labReports,
      labValues,
      supplements,
      openPoints,
      timelineEntries,
      documents,
    } = result.data;
    const markdown = exportProfileAsMarkdown(
      profile,
      observations,
      labReports,
      labValues,
      supplements,
      openPoints,
      timelineEntries,
      exportOptions,
      documents,
    );
    const filename = generateMarkdownFilename();
    triggerDownload(markdown, filename, 'text/markdown;charset=utf-8');
    setStatus({ kind: 'idle' });
    onClose();
  }

  async function handleCsvExport(): Promise<void> {
    setStatus({ kind: 'working' });
    const result = await loadExportData();
    if (result.kind === 'no-profile') {
      setStatus({ kind: 'error', message: t('error.no-profile') });
      return;
    }
    if (result.kind === 'locked') {
      setStatus({ kind: 'error', message: t('error.locked') });
      return;
    }
    if (result.kind === 'error') {
      setStatus({
        kind: 'error',
        message: t('error.load-failed', { detail: result.message }),
      });
      return;
    }
    const { labReports, labValues } = result.data;
    const csv = exportLabValuesAsCsv({
      labReports,
      labValues,
      t,
      locale: i18n.language,
      options: exportOptions,
    });
    triggerDownload(csv, generateCsvFilename(), 'text/csv;charset=utf-8');
    setStatus({ kind: 'idle' });
    onClose();
  }

  async function handlePdfExport(): Promise<void> {
    setStatus({ kind: 'working' });
    const result = await loadExportData();
    if (result.kind === 'no-profile') {
      setStatus({ kind: 'error', message: t('error.no-profile') });
      return;
    }
    if (result.kind === 'locked') {
      setStatus({ kind: 'error', message: t('error.locked') });
      return;
    }
    if (result.kind === 'error') {
      setStatus({
        kind: 'error',
        message: t('error.load-failed', { detail: result.message }),
      });
      return;
    }
    try {
      const { exportProfileAsPdf } = await import('./pdfExport');
      const {
        profile,
        observations,
        labReports,
        labValues,
        supplements,
        openPoints,
        documents,
      } = result.data;
      const blob = await exportProfileAsPdf({
        profile,
        observations,
        labReports,
        labValues,
        supplements,
        openPoints,
        documents,
        t,
        locale: i18n.language,
        dateRange: exportOptions.dateRange,
        themes: exportOptions.themes,
        includeLinkedDocuments: exportOptions.includeLinkedDocuments,
      });
      triggerDownload(blob, generatePdfFilename(), 'application/pdf');
      setStatus({ kind: 'idle' });
      onClose();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setStatus({ kind: 'error', message: t('error.pdf-failed', { detail }) });
    }
  }

  if (!open) return null;

  const working = status.kind === 'working';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !working) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="document"
        className="flex w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-900 dark:shadow-black/60"
      >
        <header className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2
            id="export-dialog-title"
            className="text-lg font-bold text-gray-900 dark:text-gray-100"
          >
            {t('dialog.title')}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('dialog.description')}</p>
        </header>

        <div className="flex flex-col gap-3 px-6 py-4">
          <DateRangeFilter
            from={fromIso}
            to={toIso}
            onFromChange={setFromIso}
            onToChange={setToIso}
            fromLabel={t('date-range.from')}
            toLabel={t('date-range.to')}
            groupAriaLabel={t('date-range.aria-label')}
            testId="export-date-range"
          />

          {availableThemes.length > 0 && (
            <fieldset
              data-testid="export-themes-filter"
              className="m-0 flex flex-col gap-1.5 border-0 p-0"
            >
              <legend className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                {t('themes.label')}
              </legend>
              <p className="mb-1 text-xs text-gray-600 dark:text-gray-400">
                {t('themes.hint')}
              </p>
              <div className="flex flex-col gap-1">
                {availableThemes.map((theme) => {
                  const checked = !excludedThemes.includes(theme);
                  return (
                    <label
                      key={theme}
                      className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-sm text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTheme(theme)}
                        data-testid={`export-themes-checkbox-${theme}`}
                        className="h-4 w-4"
                      />
                      <span className="break-words">{theme}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <label
            data-testid="export-appendix-toggle"
            className="flex min-h-[44px] cursor-pointer items-start gap-2 rounded-sm px-1 py-1 text-sm text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            <input
              type="checkbox"
              checked={includeLinkedDocuments}
              onChange={(e) => setIncludeLinkedDocuments(e.target.checked)}
              data-testid="export-appendix-checkbox"
              className="mt-0.5 h-4 w-4"
            />
            <span className="flex flex-col">
              <span>{t('appendix.toggle.label')}</span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {t('appendix.toggle.hint')}
              </span>
            </span>
          </label>

          <button
            type="button"
            onClick={() => void handleMarkdownExport()}
            disabled={working}
            data-testid="export-markdown-button"
            className="rounded-sm border border-gray-300 px-4 py-3 text-left text-sm text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            <span className="font-semibold">{t('dialog.markdown.title')}</span>
            <br />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {t('dialog.markdown.description')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handlePdfExport()}
            disabled={working}
            data-testid="export-pdf-button"
            className="rounded-sm border border-gray-300 px-4 py-3 text-left text-sm text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            <span className="font-semibold">{t('dialog.pdf.title')}</span>
            <br />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {t('dialog.pdf.description')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => void handleCsvExport()}
            disabled={working}
            data-testid="export-csv-button"
            className="rounded-sm border border-gray-300 px-4 py-3 text-left text-sm text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            <span className="font-semibold">{t('dialog.csv.title')}</span>
            <br />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {t('dialog.csv.description')}
            </span>
          </button>

          {status.kind === 'error' && (
            <p
              role="alert"
              data-testid="export-error"
              className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
            >
              {status.message}
            </p>
          )}

          {working && (
            <p
              role="status"
              aria-live="polite"
              data-testid="export-working"
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              {t('dialog.working')}
            </p>
          )}
        </div>

        <footer className="flex justify-end border-t border-gray-200 px-6 py-3 dark:border-gray-700">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={working}
            className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('common:action.cancel')}
          </button>
        </footer>
      </div>
    </div>
  );
}
