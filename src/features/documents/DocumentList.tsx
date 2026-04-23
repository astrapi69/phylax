import { useTranslation } from 'react-i18next';
import { useDocuments } from './useDocuments';
import { DocumentListItem } from './DocumentListItem';

export interface DocumentListProps {
  /**
   * Bump this on every action that mutates the list (upload complete,
   * delete) so the hook refetches. Default 0; caller-owned.
   */
  versionKey?: number;
}

/**
 * Documents list for the current profile. Metadata-only fetch from
 * the repository; per-item image thumbnails load lazily in their own
 * components. Shows loading placeholder, error banner, or empty-state
 * as appropriate.
 */
export function DocumentList({ versionKey = 0 }: DocumentListProps) {
  const { t } = useTranslation('documents');
  const { state } = useDocuments(versionKey);

  if (state.kind === 'loading') {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400" data-testid="documents-loading">
        {t('list.loading')}
      </p>
    );
  }

  if (state.kind === 'error') {
    return (
      <p
        role="alert"
        className="text-sm text-red-600 dark:text-red-400"
        data-testid="documents-error"
      >
        {state.error.kind === 'no-profile' ? t('list.error.no-profile') : t('list.error.generic')}
      </p>
    );
  }

  if (state.documents.length === 0) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400" data-testid="documents-empty">
        {t('list.empty')}
      </p>
    );
  }

  return (
    <ul
      className="flex flex-col gap-2"
      aria-label={t('list.aria-label')}
      data-testid="documents-list"
    >
      {state.documents.map((doc) => (
        <DocumentListItem key={doc.id} document={doc} />
      ))}
    </ul>
  );
}
