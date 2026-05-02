import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentContent, type DocumentContentState } from './useDocumentContent';
import { isImageMimeType, isPdfMimeType } from './mimeTypes';
import { ImageViewer } from './ImageViewer';
import { LinkEditor } from './LinkEditor';
import { DeleteDocumentButton } from './DeleteDocumentButton';

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
      {state.kind === 'ready' && <DeleteDocumentButton document={state.document} />}
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
  // in `mimeTypes.ts` - NOT an `image/*` prefix match - because
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
  // BUG-03 part 3: switch from `<iframe sandbox=...>` to `<object>`
  // because Chromium refuses to navigate iframes to blob: URLs in
  // several scope-/SW-related edge cases ("Not allowed to load local
  // resource: blob:..."). Firefox handles the iframe path but prompts
  // the user; Chromium hard-blocks. The `<object>` element bypasses
  // the iframe-navigation logic entirely and routes the blob straight
  // into the browser's PDF plugin (Chromium PDFium, Firefox pdf.js,
  // Safari WebKit PDF) which handles blob URLs natively.
  //
  // Security trade-off: `<object>` has no sandbox attribute. The PDF
  // viewer still runs as browser-managed code (not arbitrary HTML+JS)
  // and PDF-embedded JavaScript runs in a restricted Acrobat-style
  // context that does NOT expose web-storage APIs. The Phylax master
  // key lives in a module-level variable inside `src/crypto/keyStore.
  // ts`, never in IndexedDB nor in any web-storage API; even worst-
  // case storage access from a PDF could not extract the unlocked
  // AES key. This matches the threat model documented in
  // `docs/CONCEPT.md`: Phylax does not protect against browser
  // exploits or compromised OS / browser.
  //
  // The fallback paragraph inside `<object>` renders only when the
  // browser cannot show the PDF inline (very old browsers, some
  // mobile WebViews) and offers a download link via the same blob
  // URL. `aria-label` carries the filename for SR users.
  return (
    <object
      data={url}
      type="application/pdf"
      aria-label={filename}
      className="h-[80vh] w-full rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      data-testid="pdf-viewer-iframe"
    >
      <p className="p-4 text-sm text-gray-700 dark:text-gray-300">
        <a
          href={url}
          download={filename}
          className="text-blue-700 underline hover:text-blue-800 dark:text-blue-300"
        >
          {filename}
        </a>
      </p>
    </object>
  );
}
