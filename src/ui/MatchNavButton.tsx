/**
 * Up / Down match-nav button (P-22b/c/d-polish).
 *
 * Shared chrome for the prev / next buttons in the search-result
 * counter cluster of every list view (Observations + Lab-Values +
 * Supplements + Open-Points). Pure visual primitive: receives the
 * `direction` ('up' | 'down') + handler + aria-label and renders a
 * 44 x 44 hit target with a chevron icon. State (whether to show
 * the buttons at all, what the active index is, etc.) is the
 * caller's concern.
 */
export interface MatchNavButtonProps {
  direction: 'up' | 'down';
  onClick: () => void;
  ariaLabel: string;
  testId?: string;
  disabled?: boolean;
}

export function MatchNavButton({
  direction,
  onClick,
  ariaLabel,
  testId,
  disabled,
}: MatchNavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={disabled}
      data-testid={testId}
      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-default disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
    >
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="currentColor"
        aria-hidden="true"
        style={{ transform: direction === 'up' ? 'rotate(180deg)' : undefined }}
      >
        <path d="M3.204 5h9.592L8 10.481zm-.753.659l4.796 5.48a1 1 0 0 0 1.506 0l4.796-5.48c.566-.647.106-1.659-.753-1.659H3.204a1 1 0 0 0-.753 1.659" />
      </svg>
    </button>
  );
}
