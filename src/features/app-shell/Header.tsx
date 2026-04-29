import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { lock } from '../../crypto';
import { ThemeToggle } from '../theme';

interface HeaderProps {
  /**
   * Mobile hamburger handler. AppShell owns the drawer state and
   * passes the opener so the trigger lives in the header. Desktop
   * (`md:` and up) ignores it: NavBar's side panel is always
   * visible, so the hamburger is hidden via `md:hidden`.
   */
  onOpenNavDrawer?: () => void;
}

/**
 * Top header bar with app name + (mobile) hamburger trigger + theme
 * toggle + lock button.
 *
 * Visible on all authenticated routes inside the app shell.
 *
 * BUG-02: hamburger button added top-left for mobile (`< md`). It
 * opens the NavDrawer which hosts every NAV_ITEM in a vertical
 * stack. Desktop keeps the always-visible side NavBar; the
 * hamburger is hidden via `md:hidden`.
 */
export function Header({ onOpenNavDrawer }: HeaderProps) {
  const { t } = useTranslation('app-shell');
  return (
    <header className="fixed top-0 right-0 left-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        {onOpenNavDrawer && (
          <button
            type="button"
            onClick={onOpenNavDrawer}
            aria-label={t('header.open-nav')}
            data-testid="header-hamburger"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 md:hidden dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <HamburgerIcon />
          </button>
        )}
        <Link
          to="/profile"
          className="text-lg font-bold text-gray-900 no-underline dark:text-gray-100"
        >
          Phylax
        </Link>
      </div>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => lock()}
          className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          aria-label={t('header.lock-aria-label')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="hidden md:inline">{t('header.lock')}</span>
        </button>
      </div>
    </header>
  );
}

function HamburgerIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="20"
      height="20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5" />
    </svg>
  );
}
