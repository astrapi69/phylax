import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const NAV_ITEMS = [
  { to: '/profile', i18n: 'app-shell:nav.profile' },
  { to: '/observations', i18n: 'app-shell:nav.observations' },
  { to: '/lab-values', i18n: 'app-shell:nav.lab-values' },
  { to: '/supplements', i18n: 'app-shell:nav.supplements' },
  { to: '/open-points', i18n: 'common:entity.open-points' },
  { to: '/timeline', i18n: 'app-shell:nav.timeline' },
  { to: '/documents', i18n: 'app-shell:nav.documents' },
  { to: '/chat', i18n: 'common:entity.ai-assistant' },
  { to: '/import', i18n: 'app-shell:nav.import' },
  { to: '/settings', i18n: 'app-shell:nav.settings' },
] as const;

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const base = 'block rounded-sm px-3 py-2 text-sm transition-colors no-underline';
  return isActive
    ? `${base} bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300`
    : `${base} text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100`;
}

/**
 * Navigation bar. Bottom on mobile (< md), side on desktop (>= md).
 * Uses NavLink for active-route highlighting.
 */
export function NavBar() {
  const { t } = useTranslation('app-shell');
  return (
    <nav aria-label={t('nav.aria-label')}>
      {/* Mobile: bottom fixed bar */}
      <div className="fixed right-0 bottom-0 left-0 z-40 flex h-16 items-center justify-around border-t border-gray-200 bg-white md:hidden dark:border-gray-700 dark:bg-gray-900">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={navLinkClass}>
            <span className="text-xs">{t(item.i18n)}</span>
          </NavLink>
        ))}
      </div>

      {/* Desktop: side panel */}
      <div className="hidden md:fixed md:top-14 md:bottom-0 md:left-0 md:flex md:w-48 md:flex-col md:gap-1 md:border-r md:border-gray-200 md:bg-white md:p-3 md:dark:border-gray-700 md:dark:bg-gray-900">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={navLinkClass}>
            {t(item.i18n)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
