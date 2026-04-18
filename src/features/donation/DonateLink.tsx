import type { MouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DONATION_URL } from './constants';

interface DonateLinkProps {
  children: ReactNode;
  /**
   * Visual styling. 'primary' is a filled blue button suitable for
   * onboarding and settings; 'subtle' is an inline underlined link
   * for the reminder banner.
   */
  variant?: 'primary' | 'subtle';
  /**
   * Optional side-effect fired before the browser follows the link
   * (e.g., flipping a localStorage flag). Runs synchronously so the
   * flag is persisted even if the user aborts the new tab.
   */
  onBeforeNavigate?: () => void;
  className?: string;
}

/**
 * Reusable external link to the donation landing page (DONATE.md).
 *
 * Always opens in a new tab with `rel="noopener noreferrer"` so the
 * donation page cannot reach back into Phylax via `window.opener`.
 * The donation URL is centralized in constants.ts - the component
 * never takes an href prop.
 */
export function DonateLink({
  children,
  variant = 'primary',
  onBeforeNavigate,
  className,
}: DonateLinkProps) {
  const { t } = useTranslation('donation');
  const base = 'inline-flex items-center gap-1 transition-colors';
  const style =
    variant === 'primary'
      ? 'rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600'
      : 'text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100';

  function handleClick(_event: MouseEvent<HTMLAnchorElement>) {
    onBeforeNavigate?.();
  }

  return (
    <a
      href={DONATION_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`${base} ${style} ${className ?? ''}`.trim()}
    >
      {children}
      <span aria-hidden>↗</span>
      <span className="sr-only">{t('link.new-tab')}</span>
    </a>
  );
}
