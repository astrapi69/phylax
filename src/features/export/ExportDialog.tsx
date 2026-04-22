import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exportProfileAsMarkdown } from './markdownExport';
import { triggerDownload } from './download';
import { generateMarkdownFilename } from './filenames';
import { useExportData } from './useExportData';

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
  const { t } = useTranslation('export');
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ExportStatus>({ kind: 'idle' });
  const { loadExportData } = useExportData();

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
    } = result.data;
    const markdown = exportProfileAsMarkdown(
      profile,
      observations,
      labReports,
      labValues,
      supplements,
      openPoints,
      timelineEntries,
    );
    const filename = generateMarkdownFilename();
    triggerDownload(markdown, filename, 'text/markdown;charset=utf-8');
    setStatus({ kind: 'idle' });
    onClose();
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
