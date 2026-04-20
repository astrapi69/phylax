import { useTranslation } from 'react-i18next';

export function DocumentsPlaceholder() {
  const { t } = useTranslation('documents');
  return (
    <div>
      <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">{t('heading')}</h1>
      <p className="text-gray-600 dark:text-gray-400">{t('placeholder')}</p>
    </div>
  );
}
