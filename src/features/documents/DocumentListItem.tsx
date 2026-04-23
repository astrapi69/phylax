import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Document } from '../../domain';
import { DocumentRepository } from '../../db/repositories';
import { isImageMimeType } from './mimeTypes';

export interface DocumentListItemProps {
  document: Document;
}

/**
 * Single row in the documents list. Metadata is rendered immediately
 * from the Document object; an image thumbnail (for `image/*` MIME
 * types) is fetched on mount by decrypting the blob and wrapping it
 * in an object URL. Non-image documents render a generic file icon.
 *
 * Memory hygiene: every blob URL created here is revoked on unmount
 * (or when the thumbnail promise resolves after the component has
 * already unmounted) so nothing leaks between list re-renders or
 * navigations away from the documents view.
 */
export function DocumentListItem({ document }: DocumentListItemProps) {
  const { t, i18n } = useTranslation('documents');
  const isImage = isImageMimeType(document.mimeType);
  const thumbnailUrl = useThumbnailUrl(document, isImage);

  const sizeLabel = formatSize(document.sizeBytes);
  const dateLabel = formatDate(document.createdAt, i18n.language);

  return (
    <li data-testid={`document-item-${document.id}`}>
      <Link
        to={`/documents/${document.id}`}
        className="flex items-center gap-3 rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-900 hover:border-blue-400 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
        data-testid={`document-item-link-${document.id}`}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
          {isImage && thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
              data-testid="thumbnail"
            />
          ) : (
            <FileIcon mimeType={document.mimeType} />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-medium">{document.filename}</span>
            <LinkIndicator document={document} />
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('list.meta', { size: sizeLabel, date: dateLabel })}
          </span>
        </div>
      </Link>
    </li>
  );
}

function LinkIndicator({ document }: { document: Document }) {
  const { t } = useTranslation('documents');
  const kind = document.linkedObservationId
    ? 'observation'
    : document.linkedLabValueId
      ? 'lab-value'
      : null;
  if (!kind) return null;
  const tooltip = t('list.link-indicator-tooltip', { kind: t(`link.kind.${kind}`) });
  return (
    <span
      role="img"
      aria-label={tooltip}
      title={tooltip}
      className="shrink-0 text-blue-600 dark:text-blue-400"
      data-testid={`link-indicator-${kind}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" />
      </svg>
    </span>
  );
}

/**
 * Decrypt the document blob once and expose its content as an object
 * URL for rendering. Revokes the URL on unmount or when the component
 * is unmounted while the decrypt is still in flight.
 */
function useThumbnailUrl(document: Document, enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let revokedUrl: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        const repo = new DocumentRepository();
        const content = await repo.getContent(document.id);
        if (cancelled || !content) return;
        const blob = new Blob([content], { type: document.mimeType });
        const objectUrl = URL.createObjectURL(blob);
        revokedUrl = objectUrl;
        setUrl(objectUrl);
      } catch {
        // Swallow: list continues to render metadata + generic icon.
        // Viewer components (D-05/D-06) surface decrypt errors to the
        // user; the list is read-only metadata.
      }
    })();

    return () => {
      cancelled = true;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [document.id, document.mimeType, enabled]);

  return url;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const isPdf = mimeType === 'application/pdf';
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-gray-500 dark:text-gray-400"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      {isPdf && <path d="M9 15h6M9 11h6" />}
    </svg>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(unixMs: number, language: string): string {
  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(unixMs);
}
