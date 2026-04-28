import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalBody, ModalFooter, ModalHeader, useModalTitleId } from '../../ui';
import { MarkdownContent } from '../profile-view';

/**
 * Export preview modal (X-07). Three rendering paths share one modal
 * shell:
 *
 * - Markdown: rendered via the existing `MarkdownContent` so the user
 *   sees how the file will look in a markdown viewer.
 * - PDF: `<iframe sandbox="allow-scripts">` with a Blob URL. Same
 *   pattern + security posture as `DocumentViewer.tsx`. Browser's
 *   native PDF viewer provides zoom / page navigation / print for
 *   free; no pdfjs-dist required for this path.
 * - CSV: HTML `<table>` from the row data passed in. Caller is
 *   responsible for producing rows via `buildLabRows()` so the
 *   preview matches the downloaded CSV byte-for-byte (column
 *   definitions, sort, filtering all live in the export module).
 *
 * Caller has already generated the artifact (string / Blob / row
 * shape). The modal does not regenerate; it only renders. Download
 * action triggers from inside the modal so the user can commit
 * without going back to the dialog.
 *
 * Memory hygiene: when the kind is `pdf`, the modal calls
 * `URL.revokeObjectURL` on close and on unmount so the Blob URL is
 * not leaked. PDF Blob URLs cluster up fast under repeat-preview
 * usage.
 */
export type PreviewContent =
  | { kind: 'markdown'; text: string }
  | { kind: 'pdf'; blob: Blob }
  | {
      kind: 'csv';
      headers: readonly string[];
      rows: readonly (readonly string[])[];
    };

export interface ExportPreviewProps {
  open: boolean;
  onClose: () => void;
  content: PreviewContent | null;
  /** Called when the user clicks the in-modal Download button. */
  onDownload: () => void;
}

export function ExportPreview({ open, onClose, content, onDownload }: ExportPreviewProps) {
  const { t } = useTranslation('export');
  const titleId = useModalTitleId();

  // Lazily build the Blob URL for PDF previews; revoke on cleanup.
  const pdfUrl = usePdfBlobUrl(content);

  if (!open || !content) return null;

  const titleKey =
    content.kind === 'markdown'
      ? 'preview.title.markdown'
      : content.kind === 'pdf'
      ? 'preview.title.pdf'
      : 'preview.title.csv';

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={titleId}
      role="dialog"
      size="xl"
      closeOnBackdropClick
      zIndex={60}
    >
      <ModalHeader titleId={titleId}>{t(titleKey)}</ModalHeader>
      <ModalBody>
        {content.kind === 'markdown' && <MarkdownPreview text={content.text} />}
        {content.kind === 'pdf' && pdfUrl && <PdfPreview url={pdfUrl} title={t(titleKey)} />}
        {content.kind === 'csv' && (
          <CsvPreview headers={content.headers} rows={content.rows} />
        )}
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          data-testid="export-preview-close"
          className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('preview.close')}
        </button>
        <button
          type="button"
          onClick={onDownload}
          data-testid="export-preview-download"
          className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('preview.download')}
        </button>
      </ModalFooter>
    </Modal>
  );
}

function usePdfBlobUrl(content: PreviewContent | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!content || content.kind !== 'pdf') {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(content.blob);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [content]);
  return url;
}

function MarkdownPreview({ text }: { text: string }) {
  const { t } = useTranslation('export');
  if (text.trim() === '') {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400" data-testid="export-preview-empty">
        {t('preview.empty.markdown')}
      </p>
    );
  }
  return (
    <div data-testid="export-preview-markdown" className="max-h-[60vh] overflow-y-auto">
      <MarkdownContent>{text}</MarkdownContent>
    </div>
  );
}

function PdfPreview({ url, title }: { url: string; title: string }) {
  // sandbox="allow-scripts" matches DocumentViewer's PDF iframe so the
  // browser's built-in PDF viewer (Chromium pdfium, Firefox pdf.js,
  // Safari WebKit PDF) runs while the embedded JS is denied access to
  // the Phylax origin's IndexedDB / localStorage / in-memory keys.
  return (
    <iframe
      src={url}
      title={title}
      sandbox="allow-scripts"
      data-testid="export-preview-pdf-iframe"
      className="h-[70vh] w-full rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
    />
  );
}

function CsvPreview({
  headers,
  rows,
}: {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
}) {
  const { t } = useTranslation('export');
  const rowCount = useMemo(() => rows.length, [rows]);
  if (rowCount === 0) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400" data-testid="export-preview-empty">
        {t('preview.empty.csv')}
      </p>
    );
  }
  return (
    <div className="max-h-[60vh] overflow-auto" data-testid="export-preview-csv">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="border-b border-gray-300 px-2 py-1 font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="even:bg-gray-50 dark:even:bg-gray-900/40"
              data-testid="export-preview-csv-row"
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="border-b border-gray-200 px-2 py-1 text-gray-800 dark:border-gray-700 dark:text-gray-200"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
