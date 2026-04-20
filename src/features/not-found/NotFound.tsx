import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFound() {
  const { t } = useTranslation('not-found');
  return (
    <div>
      <h1 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">{t('heading')}</h1>
      <p className="mb-4 text-gray-600 dark:text-gray-400">{t('message')}</p>
      <Link
        to="/profile"
        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
      >
        {t('back')}
      </Link>
    </div>
  );
}
