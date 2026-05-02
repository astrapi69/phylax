import type { ReactNode } from 'react';

export interface EmptyStatePanelProps {
  /** Optional icon shown above the title. Defaults to a generic empty-box SVG. */
  icon?: ReactNode;
  /** Section heading. Renders as `<h2>` so the page-level `<h1>` stays primary. */
  title: string;
  /** Body text under the title. Plain string; consumers compose multiple paragraphs by wrapping in a node. */
  body: ReactNode;
  /**
   * Call-to-action shown below the body. Pass an inline link, button,
   * or arbitrary node. Optional - some empty states are pure
   * informational with no next action.
   */
  cta?: ReactNode;
  /** Optional test id passthrough; defaults to `empty-state-panel`. */
  testId?: string;
}

/**
 * Shared empty-state shell (O-19). Replaces the previous five
 * inline `EmptyState` copies across observations, lab values,
 * supplements, open points, and timeline. Establishes a consistent
 * visual hierarchy: icon, title (h2), body, CTA.
 *
 * Centered, generous padding for legibility on mobile. Background
 * matches the existing inline empty-state container so the visual
 * change is hierarchy + icon, not a wholesale redesign.
 *
 * Default icon is a hand-drawn inline SVG (no icon library, per
 * project bundle hygiene). Per-view custom icons are deferred
 * polish; callers can override via the `icon` prop today if
 * needed without waiting for that polish.
 */
export function EmptyStatePanel({
  icon,
  title,
  body,
  cta,
  testId = 'empty-state-panel',
}: EmptyStatePanelProps) {
  return (
    <section
      data-testid={testId}
      className="flex flex-col items-center gap-3 rounded-sm border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800/60"
    >
      <span aria-hidden="true" className="text-gray-400 dark:text-gray-500">
        {icon ?? <DefaultEmptyIcon />}
      </span>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <div className="max-w-prose text-sm text-gray-700 dark:text-gray-300">{body}</div>
      {cta && <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">{cta}</div>}
    </section>
  );
}

function DefaultEmptyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="48"
      height="48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}
