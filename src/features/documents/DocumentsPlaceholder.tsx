import { useTranslation } from 'react-i18next';
import { DocumentUploadButton } from './DocumentUploadButton';

/**
 * Documents view. D-02 ships the upload button; D-04 adds a list of
 * uploaded documents and replaces the empty-state copy with a real
 * list. The component name remains `DocumentsPlaceholder` until the
 * file is renamed in D-04 to keep the route + import surface stable
 * across this commit.
 */
export function DocumentsPlaceholder() {
  const { t } = useTranslation('documents');
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-gray-100">{t('heading')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('intro')}</p>
      </div>
      <DocumentUploadButton />
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('list.empty')}</p>
    </div>
  );
}
