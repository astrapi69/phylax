import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { lock } from '../../crypto';
import { ThemeToggle } from '../theme';
import { SearchIcon } from '../../ui';
import { useSearch } from '../search-trigger';

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
 * Top header bar with app name + (mobile) hamburger trigger +
 * search magnifier (when current route has search) + theme toggle
 * + lock button.
 *
 * Visible on all authenticated routes inside the app shell.
 *
 * BUG-02: hamburger button added top-left for mobile (`< md`). It
 * opens the NavDrawer which hosts every NAV_ITEM in a vertical
 * stack. Desktop keeps the always-visible side NavBar; the
 * hamburger is hidden via `md:hidden`.
 *
 * P-22 pivot: search magnifier lives in the right cluster next to
 * the theme toggle. Visibility comes from `useSearch().hasSearch`
 * (true when the current route is in `SEARCH_ROUTES`). Click
 * toggles the inline search bar in the view body. An indicator dot
 * appears when filters are active (URL has `q` / `from` / `to`)
 * but the bar is collapsed, mirroring the previous in-view
 * behaviour from P-22a/b.
 */
export function Header({ onOpenNavDrawer }: HeaderProps) {
  const { t } = useTranslation('app-shell');
  const { hasSearch, hasActiveFilter, isOpen, toggle } = useSearch();
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
        {hasSearch && (
          <SearchHeaderToggle
            isOpen={isOpen}
            showActiveIndicator={!isOpen && hasActiveFilter}
            onClick={toggle}
            openLabel={t('common:search.open')}
            closeLabel={t('common:search.close')}
            activeIndicatorLabel={t('header.search-filter-active')}
          />
        )}
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

function SearchHeaderToggle({
  isOpen,
  showActiveIndicator,
  onClick,
  openLabel,
  closeLabel,
  activeIndicatorLabel,
}: {
  isOpen: boolean;
  showActiveIndicator: boolean;
  onClick: () => void;
  openLabel: string;
  closeLabel: string;
  activeIndicatorLabel: string;
}) {
  const label = isOpen ? closeLabel : openLabel;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={showActiveIndicator ? `${label} (${activeIndicatorLabel})` : label}
      aria-expanded={isOpen}
      title={label}
      data-testid="header-search-toggle"
      className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      {/* Magnifier always visible: it is the search trigger.
       *  When open, an X badge in the top-right corner of the icon
       *  signals "click to close" so users see the magnifier as a
       *  stable identity and the X as a transient state hint. The
       *  active-filter indicator dot only renders when CLOSED;
       *  while open, the user can see the filter context inline in
       *  the view body so the dot would be redundant noise. */}
      <SearchIcon />
      {isOpen && (
        <span
          aria-hidden="true"
          data-testid="header-search-toggle-close-badge"
          className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm dark:bg-blue-400 dark:text-gray-900"
        >
          <CloseBadgeIcon />
        </span>
      )}
      {!isOpen && showActiveIndicator && (
        <span
          aria-hidden="true"
          data-testid="header-search-toggle-active-indicator"
          className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400"
        />
      )}
    </button>
  );
}

function CloseBadgeIcon() {
  return (
    <svg viewBox="0 0 8 8" width="7" height="7" fill="currentColor" aria-hidden="true">
      <path d="M1.146 1.146a.5.5 0 0 1 .708 0L4 3.293l2.146-2.147a.5.5 0 1 1 .708.708L4.707 4l2.147 2.146a.5.5 0 1 1-.708.708L4 4.707 1.854 6.854a.5.5 0 0 1-.708-.708L3.293 4 1.146 1.854a.5.5 0 0 1 0-.708" />
    </svg>
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
