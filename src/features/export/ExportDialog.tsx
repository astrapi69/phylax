import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DateRangeFilter,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  useModalTitleId,
} from '../../ui';
import { buildLabRows, exportLabValuesAsCsv } from './csvExport';
import { ExportPreview, type PreviewContent } from './ExportPreview';
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
  const titleId = useModalTitleId();
  const [status, setStatus] = useState<ExportStatus>({ kind: 'idle' });
  const { loadExportData } = useExportData();

  // X-03 date-range filter. ISO strings in dialog state; converted to
  // Date objects only at the export boundary so the dialog UI matches
  // the O-18 `<DateRangeFilter>` semantic. Both bounds are optional;
  // empty inputs mean "no bound on that side". Dialog returns null
  // while closed (see below), so React's natural lifecycle resets
  // these on dialog close - no explicit clearing logic.
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
  // X-07 export preview. The dialog generates the same artifact the
  // download path produces and hands it to <ExportPreview>; the
  // preview's Download button then triggers the existing download
  // path with the cached artifact (no regeneration).
  const [preview, setPreview] = useState<{
    content: PreviewContent;
    filename: string;
    mimeType: string;
  } | null>(null);
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
    if (availableThemes.length > 0 && excludedThemes.length > 0 && selectedThemes.length > 0) {
      opts.themes = selectedThemes;
    }
    if (includeLinkedDocuments) {
      opts.includeLinkedDocuments = true;
    }
    return opts;
  }, [fromIso, toIso, availableThemes, excludedThemes, selectedThemes, includeLinkedDocuments]);

  // Reset status to idle whenever the dialog is (re)opened. Focus
  // management for the close button is provided by the Modal primitive
  // via `initialFocusRef={closeRef}` below.
  useEffect(() => {
    if (open) {
      setStatus({ kind: 'idle' });
    }
  }, [open]);

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

  async function loadDataOrError(): Promise<
    | {
        ok: true;
        data: NonNullable<Awaited<ReturnType<typeof loadExportData>> & { kind: 'ok' }>['data'];
      }
    | { ok: false }
  > {
    setStatus({ kind: 'working' });
    const result = await loadExportData();
    if (result.kind === 'no-profile') {
      setStatus({ kind: 'error', message: t('error.no-profile') });
      return { ok: false };
    }
    if (result.kind === 'locked') {
      setStatus({ kind: 'error', message: t('error.locked') });
      return { ok: false };
    }
    if (result.kind === 'error') {
      setStatus({
        kind: 'error',
        message: t('error.load-failed', { detail: result.message }),
      });
      return { ok: false };
    }
    return { ok: true, data: result.data };
  }

  async function handleMarkdownPreview(): Promise<void> {
    const loaded = await loadDataOrError();
    if (!loaded.ok) return;
    const {
      profile,
      observations,
      labReports,
      labValues,
      supplements,
      openPoints,
      timelineEntries,
      documents,
    } = loaded.data;
    const text = exportProfileAsMarkdown(
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
    setPreview({
      content: { kind: 'markdown', text },
      filename: generateMarkdownFilename(),
      mimeType: 'text/markdown;charset=utf-8',
    });
    setStatus({ kind: 'idle' });
  }

  async function handleCsvPreview(): Promise<void> {
    const loaded = await loadDataOrError();
    if (!loaded.ok) return;
    const { labReports, labValues } = loaded.data;
    const { headers, rows } = buildLabRows({
      labReports,
      labValues,
      t,
      options: exportOptions,
    });
    setPreview({
      content: { kind: 'csv', headers, rows },
      filename: generateCsvFilename(),
      mimeType: 'text/csv;charset=utf-8',
    });
    setStatus({ kind: 'idle' });
  }

  async function handlePdfPreview(): Promise<void> {
    const loaded = await loadDataOrError();
    if (!loaded.ok) return;
    try {
      const { exportProfileAsPdf } = await import('./pdfExport');
      const { profile, observations, labReports, labValues, supplements, openPoints, documents } =
        loaded.data;
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
      setPreview({
        content: { kind: 'pdf', blob },
        filename: generatePdfFilename(),
        mimeType: 'application/pdf',
      });
      setStatus({ kind: 'idle' });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setStatus({ kind: 'error', message: t('error.pdf-failed', { detail }) });
    }
  }

  async function handlePreviewDownload(): Promise<void> {
    if (!preview) return;
    const { content, filename, mimeType } = preview;
    if (content.kind === 'pdf') {
      triggerDownload(content.blob, filename, mimeType);
    } else if (content.kind === 'markdown') {
      triggerDownload(content.text, filename, mimeType);
    } else {
      // CSV: re-serialize from the same rows the preview rendered.
      // The data is small; avoid stashing two parallel
      // representations on the preview state object.
      const loaded = await loadDataOrError();
      if (!loaded.ok) return;
      const { labReports, labValues } = loaded.data;
      const csv = exportLabValuesAsCsv({
        labReports,
        labValues,
        t,
        locale: i18n.language,
        options: exportOptions,
      });
      triggerDownload(csv, filename, mimeType);
    }
    setPreview(null);
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
      const { profile, observations, labReports, labValues, supplements, openPoints, documents } =
        result.data;
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

  const working = status.kind === 'working';

  // TD-12 migration: composes the shared `<Modal>` + `ModalHeader` /
  // `Body` / `Footer` from `src/ui/Modal/`. The primitive provides
  // focus trap, Escape close, backdrop, scroll lock, portal mount,
  // and the `initialFocusRef={closeRef}` close-focused-on-mount
  // default. `closeOnEscape` and `closeOnBackdropClick` toggle off
  // while `working` so an in-flight export cannot be interrupted by
  // a stray keystroke or background click (preserves the bespoke
  // pre-migration behaviour).
  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={titleId}
      role="dialog"
      closeOnEscape={!working}
      closeOnBackdropClick={!working}
      initialFocusRef={closeRef}
      size="md"
    >
      <ModalHeader titleId={titleId} description={t('dialog.description')}>
        {t('dialog.title')}
      </ModalHeader>

      <ModalBody>
        <div className="flex flex-col gap-3">
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
              <p className="mb-1 text-xs text-gray-600 dark:text-gray-400">{t('themes.hint')}</p>
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

          {/*
            P-07-b: explicit grouping for the three format options
            (Markdown / PDF / CSV). Without `<fieldset><legend>` the
            three FormatRows render as six independent buttons in
            screen-reader output ("export markdown", "preview
            markdown", "export pdf", ...) with no signal that they
            are a related option set. The fieldset names the group;
            the legend gives the SR label. `m-0 border-0 p-0` keeps
            the visual layout unchanged. `legend.sr-only` keeps the
            existing visual chrome (dialog header already conveys
            the same meaning to sighted users) while giving AT a
            real label.
           */}
          <fieldset
            data-testid="export-formats-group"
            className="m-0 flex flex-col gap-3 border-0 p-0"
          >
            <legend className="sr-only">{t('dialog.formats.legend')}</legend>
            <FormatRow
              primaryTestId="export-markdown-button"
              previewTestId="export-markdown-preview"
              title={t('dialog.markdown.title')}
              description={t('dialog.markdown.description')}
              previewLabel={t('preview.button')}
              disabled={working}
              onExport={() => void handleMarkdownExport()}
              onPreview={() => void handleMarkdownPreview()}
            />

            <FormatRow
              primaryTestId="export-pdf-button"
              previewTestId="export-pdf-preview"
              title={t('dialog.pdf.title')}
              description={t('dialog.pdf.description')}
              previewLabel={t('preview.button')}
              disabled={working}
              onExport={() => void handlePdfExport()}
              onPreview={() => void handlePdfPreview()}
            />

            <FormatRow
              primaryTestId="export-csv-button"
              previewTestId="export-csv-preview"
              title={t('dialog.csv.title')}
              description={t('dialog.csv.description')}
              previewLabel={t('preview.button')}
              disabled={working}
              onExport={() => void handleCsvExport()}
              onPreview={() => void handleCsvPreview()}
            />
          </fieldset>

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
      </ModalBody>

      <ModalFooter>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          disabled={working}
          className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('common:action.cancel')}
        </button>
      </ModalFooter>

      {/*
        ExportPreview renders as a portal'd sibling overlay. It carries
        its own dialog primitive (not yet migrated; out of TD-12 scope).
        Both dialogs coexist via the module-level scroll-lock counter.
       */}
      <ExportPreview
        open={preview !== null}
        onClose={() => setPreview(null)}
        content={preview?.content ?? null}
        onDownload={() => void handlePreviewDownload()}
      />
    </Modal>
  );
}

interface FormatRowProps {
  primaryTestId: string;
  previewTestId: string;
  title: string;
  description: string;
  previewLabel: string;
  disabled: boolean;
  onExport: () => void;
  onPreview: () => void;
}

function FormatRow({
  primaryTestId,
  previewTestId,
  title,
  description,
  previewLabel,
  disabled,
  onExport,
  onPreview,
}: FormatRowProps) {
  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={onExport}
        disabled={disabled}
        data-testid={primaryTestId}
        className="flex-1 rounded-sm border border-gray-300 px-4 py-3 text-left text-sm text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
      >
        <span className="font-semibold">{title}</span>
        <br />
        <span className="text-xs text-gray-600 dark:text-gray-400">{description}</span>
      </button>
      <button
        type="button"
        onClick={onPreview}
        disabled={disabled}
        data-testid={previewTestId}
        className="rounded-sm border border-gray-300 px-3 py-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {previewLabel}
      </button>
    </div>
  );
}
