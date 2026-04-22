import { useTranslation } from 'react-i18next';
import { useTheme } from './useTheme';
import type { Theme } from './themeStorage';

const NEXT: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'auto',
  auto: 'light',
};

/**
 * Header-level theme cycle button. Single click advances light -> dark -> auto.
 * Icon reflects the current user choice (not the resolved theme), because users
 * cycling through states need to see what they just picked.
 */
export function ThemeToggle() {
  const { t } = useTranslation('theme');
  const { theme, setTheme } = useTheme();
  const next = NEXT[theme];
  const current = t(`label.${theme}`);
  const nextLabel = t(`label.${next}`);

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={t('aria-label', { current, next: nextLabel })}
      className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
    >
      {theme === 'light' && <SunIcon />}
      {theme === 'dark' && <MoonIcon />}
      {theme === 'auto' && <AutoIcon />}
    </button>
  );
}

const ICON_PROPS = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'h-4 w-4',
  'aria-hidden': true,
};

function SunIcon() {
  return (
    <svg {...ICON_PROPS} data-testid="theme-icon-light">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...ICON_PROPS} data-testid="theme-icon-dark">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function AutoIcon() {
  // Half-sun, half-moon: a filled semicircle on the left plus a crescent on the right,
  // conveying "follows the environment" without being decorative.
  return (
    <svg {...ICON_PROPS} data-testid="theme-icon-auto">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3 A9 9 0 0 1 12 21 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
