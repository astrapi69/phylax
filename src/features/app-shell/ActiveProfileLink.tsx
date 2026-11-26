import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Names the active profile in the header and links to the profile list
 * (M-09). The header renders it only when more than one profile exists,
 * so a single-profile installation keeps its header as it was.
 *
 * Touch target (BUG-22): below md the link sits under the app name and
 * is only 24px high, and two 44px targets do not fit into the 56px
 * header. Its `::before` therefore covers the whole block it shares with
 * the app name (the parent must be `relative`), so app name and profile
 * name are one target of at least 44 x 44. From md up the pseudo-element
 * is off and the link is 44px high by itself.
 *
 * The visible text is the name only, truncated with an ellipsis: the
 * header has no room for a caption at 360px. The caption is in the
 * accessible name ("Aktives Profil: <name>"), and `title` carries the
 * full name for a truncated one.
 */
interface ActiveProfileLinkProps {
  /** Display name of the active profile. */
  name: string;
}

export function ActiveProfileLink({ name }: ActiveProfileLinkProps) {
  const { t } = useTranslation('app-shell');
  return (
    <Link
      to="/profiles"
      aria-label={t('header.active-profile', { name })}
      title={name}
      data-testid="header-active-profile"
      className="flex min-h-[24px] max-w-full min-w-0 items-center gap-1 rounded-sm text-xs font-medium text-gray-600 no-underline transition-colors before:absolute before:inset-0 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 md:min-h-[44px] md:text-sm md:before:hidden dark:text-gray-300 dark:hover:text-gray-100"
    >
      <ProfileIcon />
      <span className="truncate" data-testid="header-active-profile-name">
        {name}
      </span>
    </Link>
  );
}

function ProfileIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
