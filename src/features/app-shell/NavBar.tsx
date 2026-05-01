import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAIConfig } from '../ai-config';
import { NAV_ITEMS, filterNavItems } from './navItems';

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const base = 'block rounded-sm px-3 py-2 text-sm transition-colors no-underline';
  return isActive
    ? `${base} bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300`
    : `${base} text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100`;
}

/**
 * Desktop-only side navigation panel.
 *
 * BUG-02: mobile bottom-nav (10 NAV_ITEMS at h-16 with
 * justify-around) squeezed each item to ~36px on a 360px viewport,
 * making the labels effectively invisible. Mobile rendering moved
 * to NavDrawer (hamburger top-left) which scales independently of
 * item count. NavBar therefore renders only at the `md` breakpoint
 * and above; mobile users open NAV_ITEMS via the drawer.
 */
export function NavBar() {
  const { t } = useTranslation('app-shell');
  // BUG-07: hide AI-gated items until the user has saved an API key.
  const { state: aiState } = useAIConfig();
  const items = useMemo(
    () => filterNavItems(NAV_ITEMS, { aiConfigured: aiState.status === 'configured' }),
    [aiState.status],
  );
  return (
    <nav
      aria-label={t('nav.aria-label')}
      className="hidden md:fixed md:top-14 md:bottom-0 md:left-0 md:flex md:w-48 md:flex-col md:gap-1 md:border-r md:border-gray-200 md:bg-white md:p-3 md:dark:border-gray-700 md:dark:bg-gray-900"
    >
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className={navLinkClass}>
          {t(item.i18n)}
        </NavLink>
      ))}
    </nav>
  );
}
