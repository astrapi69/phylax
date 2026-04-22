import { useTranslation } from 'react-i18next';

interface UpdatePromptProps {
  needRefresh: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}

/**
 * Toast-style banner shown when a new service worker version is ready.
 * Non-blocking: user can continue using the current session.
 */
export function UpdatePrompt({ needRefresh, onUpdate, onDismiss }: UpdatePromptProps) {
  const { t } = useTranslation('pwa-update');
  if (!needRefresh) {
    return null;
  }

  return (
    <div
      className="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-md rounded-lg bg-gray-800 p-4 shadow-lg"
      role="alert"
    >
      <p className="mb-3 text-sm text-white">{t('available')}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onUpdate}
          className="rounded-sm bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
        >
          {t('update')}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-sm bg-gray-600 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-500"
        >
          {t('later')}
        </button>
      </div>
    </div>
  );
}
