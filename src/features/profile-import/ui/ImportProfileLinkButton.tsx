import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface ImportProfileLinkButtonProps {
  /**
   * Optional className override so the consumer can match the
   * surrounding layout. Default mirrors `ExportButton`'s primary-action
   * treatment for paired-action visual parity.
   */
  className?: string;
}

/**
 * Pendant to `<ExportButton>` on the Profile view. Real `<Link>` (not
 * `<button onClick={navigate}>`) so keyboard activation, right-click
 * "open in new tab", and browser preloading all behave normally.
 *
 * The destination `/import` mounts the full multi-screen import wizard
 * (file selection, profile selection, preview, confirm). This button
 * is a navigation entry point only; the wizard owns its own
 * destructive-confirmation discipline internally.
 */
export function ImportProfileLinkButton({ className }: ImportProfileLinkButtonProps) {
  const { t } = useTranslation('import');
  return (
    <Link
      to="/import"
      data-testid="import-profile-link-button"
      className={
        className ??
        'inline-flex min-h-[44px] items-center justify-center rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
      }
    >
      {t('button')}
    </Link>
  );
}
