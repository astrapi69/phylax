import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExportDialog } from './ExportDialog';

interface ExportButtonProps {
  /**
   * Optional className override so the consumer can style the button to
   * match the surrounding layout (prominent on ProfileView, subtle link
   * in Settings).
   */
  className?: string;
  children?: React.ReactNode;
}

/**
 * Single-button entry point for profile export. Manages the open state
 * of ExportDialog; the dialog owns the format choice + download logic.
 */
export function ExportButton({ className, children }: ExportButtonProps) {
  const { t } = useTranslation('export');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="export-profile-button"
        className={
          className ??
          'rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
        }
      >
        {children ?? t('button')}
      </button>
      <ExportDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
