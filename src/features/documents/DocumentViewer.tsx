import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentContent, type DocumentContentState } from './useDocumentContent';
import { isImageMimeType, isPdfMimeType } from './mimeTypes';
import { ImageViewer } from './ImageViewer';
import { LinkEditor } from './LinkEditor';

/**
 * Route component for `/documents/:id`. Routes by URL param into a
 * sub-component that owns the load + dispatch; this split keeps the
 * param extraction and the content effect in separate hooks so the
 * render loop cannot race on a missing param.
 */
export function DocumentViewer() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/documents" replace />;
  return <DocumentViewerById id={id} />;
}

function DocumentViewerById({ id }: { id: string }) {
  const { t } = useTranslation('documents');
  // Bump to force a refetch after a link mutation via LinkEditor so
  // the header + LinkEditor reflect the new linked entity without a
  // full navigation. Key on the original `id` so identity changes
  // still restart the content load (hook logic in useDocumentContent).
  const [reloadKey, setReloadKey] = useState(0);
  const state = useDocumentContent(id, reloadKey);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <Link
          to="/documents"
          className="inline-flex items-center rounded-md px-2 py-1 text-sm text-blue-700 hover:bg-blue-50 hover:text-blue-900 dark:text-blue-300 dark:hover:bg-blue-900/40 dark:hover:text-blue-100"
          data-testid="viewer-back-link"
        >
          {t('viewer.back')}
        </Link>
        {state.kind === 'ready' && (
          <h1
            className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100"
            data-testid="viewer-title"
          >
            {state.document.filename}
          </h1>
        )}
      </header>
      {state.kind === 'ready' && (
        <LinkEditor document={state.document} onChanged={() => setReloadKey((k) => k + 1)} />
      )}
      <ViewerBody state={state} />
    </div>
  );
}

function ViewerBody({ state }: { state: DocumentContentState }) {
  const { t } = useTranslation('documents');

  if (state.kind === 'loading') {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400" data-testid="viewer-loading">
        {t('viewer.loading')}
      </p>
    );
  }

  if (state.kind === 'not-found') {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400" data-testid="viewer-error">
        {t('viewer.error.not-found')}
      </p>
    );
  }

  if (state.kind === 'decrypt-failed') {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400" data-testid="viewer-error">
        {t('viewer.error.decrypt-failed')}
      </p>
    );
  }

  // state.kind === 'ready'. MIME dispatcher: pick viewer by
  // metadata.mimeType (trusted since it was set at upload time and is
  // re-read from the encrypted metadata row), never by filename
  // extension. Explicit whitelist match against the shared constants
  // in `mimeTypes.ts` — NOT an `image/*` prefix match — because
  // image/svg+xml can carry script and must never silently route into
  // the image viewer.
  if (isPdfMimeType(state.document.mimeType)) {
    return <PdfViewer url={state.url} filename={state.document.filename} />;
  }

  if (isImageMimeType(state.document.mimeType)) {
    return <ImageViewer url={state.url} filename={state.document.filename} />;
  }

  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400" data-testid="viewer-error">
      {t('viewer.error.unsupported-type', { mimeType: state.document.mimeType })}
    </p>
  );
}

function PdfViewer({ url, filename }: { url: string; filename: string }) {
  // sandbox="allow-scripts" is the minimum that lets the browser's
  // built-in PDF viewer (Chromium pdfium, Firefox pdf.js, Safari
  // WebKit PDF) run inside the iframe. allow-same-origin is
  // deliberately omitted so the viewer (and any JS embedded in the
  // PDF itself, e.g. form logic) runs in an opaque origin — it
  // cannot reach the Phylax origin's IndexedDB, localStorage, or the
  // in-memory master key. Trade-off: users who upload a PDF that
  // relies on same-origin requests (unusual) will see a degraded
  // experience. Accepted. See docs/browser-support.md.
  return (
    <iframe
      src={url}
      title={filename}
      sandbox="allow-scripts"
      className="h-[80vh] w-full rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      data-testid="pdf-viewer-iframe"
    />
  );
}
