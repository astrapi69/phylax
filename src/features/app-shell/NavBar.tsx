import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/profile', label: 'Profil' },
  { to: '/observations', label: 'Beobachtungen' },
  { to: '/lab-values', label: 'Laborwerte' },
  { to: '/supplements', label: 'Supplemente' },
  { to: '/documents', label: 'Dokumente' },
  { to: '/import', label: 'Import' },
  { to: '/settings', label: 'Einstellungen' },
];

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const base = 'block rounded px-3 py-2 text-sm transition-colors no-underline';
  return isActive
    ? `${base} bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300`
    : `${base} text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100`;
}

/**
 * Navigation bar. Bottom on mobile (< md), side on desktop (>= md).
 * Uses NavLink for active-route highlighting.
 */
export function NavBar() {
  return (
    <nav aria-label="Hauptnavigation">
      {/* Mobile: bottom fixed bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={navLinkClass}>
            <span className="text-xs">{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Desktop: side panel */}
      <div className="hidden md:fixed md:bottom-0 md:left-0 md:top-14 md:flex md:w-48 md:flex-col md:gap-1 md:border-r md:border-gray-200 md:bg-white md:p-3 md:dark:border-gray-700 md:dark:bg-gray-900">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={navLinkClass}>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
