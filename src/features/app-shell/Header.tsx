import { Link } from 'react-router-dom';
import { lock } from '../../crypto';
import { ThemeToggle } from '../theme';

/**
 * Top header bar with app name and lock button.
 * Visible on all authenticated routes inside the app shell.
 */
export function Header() {
  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900">
      <Link
        to="/profile"
        className="text-lg font-bold text-gray-900 no-underline dark:text-gray-100"
      >
        Phylax
      </Link>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => lock()}
          className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          aria-label="Phylax sperren"
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
          <span className="hidden md:inline">Sperren</span>
        </button>
      </div>
    </header>
  );
}
