import { useTranslation } from 'react-i18next';
import { ConfirmDialog as O20ConfirmDialog } from '../../ui';

interface AIDisclaimerProps {
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal shown on first AI activation. Spells out the three non-negotiable
 * facts: no medical advice, data leaves the device, user controls access.
 * Confirmation is required before any API key is persisted.
 *
 * Focus lands on the cancel button by default (safer for a consent flow).
 * Escape cancels. Tab is trapped inside the dialog.
 *
 * TD-12 migration: composes the shared `<ConfirmDialog>` from
 * `src/ui/Modal/`. The primitive provides focus trap, Escape handler,
 * backdrop, cancel-focused-on-mount, and the non-destructive (blue
 * confirm + role="dialog") variant chrome. Backdrop does NOT close
 * (O-20 default) - mid-consent dismissal stays explicit (Cancel or
 * Escape).
 */
export function AIDisclaimer({ onConfirm, onCancel }: AIDisclaimerProps) {
  const { t } = useTranslation('ai-config');

  return (
    <O20ConfirmDialog
      open
      onClose={onCancel}
      title={t('disclaimer.heading')}
      body={
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {t('disclaimer.important-notice')}
          </p>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {t('disclaimer.point-1.heading')}
              </span>{' '}
              {t('disclaimer.point-1.body')}
            </li>
            <li>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {t('disclaimer.point-2.heading')}
              </span>{' '}
              {t('disclaimer.point-2.body-prefix')}
              <a
                href="https://privacy.claude.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {t('disclaimer.point-2.link-label')}
              </a>
              {t('disclaimer.point-2.body-suffix')}
            </li>
            <li>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {t('disclaimer.point-3.heading')}
              </span>{' '}
              {t('disclaimer.point-3.body')}
            </li>
          </ol>
        </div>
      }
      cancelLabel={t('common:action.cancel')}
      confirmLabel={t('disclaimer.confirm-button')}
      onConfirm={onConfirm}
    />
  );
}
