import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Global legal footer, mounted once at the App root so `/impressum`
 * and `/datenschutz` are reachable from every screen, including
 * pre-unlock screens (Section 5 DDG requires the legal notice to be
 * "immediately accessible", not buried behind a login).
 *
 * Deliberately outside the route tree: mounting it in `App.tsx` as a
 * sibling of `AppRoutes` covers every route (AppShell, onboarding,
 * unlock, backup import, 404) without touching each view.
 */
export function LegalFooter() {
  const { t } = useTranslation('legal');
  return (
    <footer className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-center dark:border-gray-800 dark:bg-gray-950">
      <nav aria-label={t('section.heading')} className="flex justify-center gap-4 text-xs">
        <Link
          to="/impressum"
          className="text-gray-600 underline hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          {t('footer.impressum-link')}
        </Link>
        <Link
          to="/datenschutz"
          className="text-gray-600 underline hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          {t('footer.privacy-policy-link')}
        </Link>
      </nav>
    </footer>
  );
}
