import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DocumentUploadButton } from './DocumentUploadButton';
import { DocumentList } from './DocumentList';
import { StorageQuotaIndicator } from './StorageQuotaIndicator';
import { PersistentStorageBanner } from './PersistentStorageBanner';

/**
 * Documents view. D-02 added the upload button; D-04 adds the list
 * with image thumbnails. The component name remains
 * `DocumentsPlaceholder` until renamed in a later cleanup pass to
 * keep the route + import surface stable.
 *
 * `refreshKey` bumps on every successful upload so the list refetches
 * without a full navigation.
 */
export function DocumentsPlaceholder() {
  const { t } = useTranslation('documents');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-gray-100">{t('heading')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('intro')}</p>
      </div>
      <PersistentStorageBanner versionKey={refreshKey} />
      <DocumentUploadButton onUploaded={() => setRefreshKey((n) => n + 1)} />
      <DocumentList versionKey={refreshKey} />
      <StorageQuotaIndicator versionKey={refreshKey} />
    </div>
  );
}
