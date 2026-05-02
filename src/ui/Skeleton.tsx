import type { CSSProperties } from 'react';

export interface SkeletonProps {
  /** CSS height value; pass a Tailwind class via `className` instead if preferred. */
  height?: string;
  /** CSS width value; defaults to 100% via the underlying class. */
  width?: string;
  /** Extra Tailwind classes (e.g., `w-1/2`, `h-4`, `rounded-full`). */
  className?: string;
}

/**
 * Single skeleton shape - a theme-aware gray rectangle with a
 * subtle pulse animation. Building block for list skeletons. Pure
 * Tailwind, zero JS, zero bundle (no `react-loading-skeleton`-style
 * library).
 *
 * `aria-hidden` is set on the shape so screen readers do not narrate
 * the placeholder; consumers wrap a list of skeletons in a
 * `role="status"` + `aria-label` container so non-visual users hear
 * the right "loading X" announcement.
 */
export function Skeleton({ height, width, className = '' }: SkeletonProps) {
  const style: CSSProperties = {};
  if (height) style.height = height;
  if (width) style.width = width;
  return (
    <span
      aria-hidden="true"
      data-testid="skeleton"
      style={style}
      className={`block rounded-sm bg-gray-200 motion-safe:animate-pulse dark:bg-gray-700 ${className}`.trim()}
    />
  );
}

export interface ListSkeletonProps {
  /** Number of placeholder items to render. */
  count: number;
  /** `card` mimics a multi-line card; `row` mimics a single compact row. */
  variant: 'card' | 'row';
  /** ARIA label announcing what is loading (e.g., "Loading observations"). */
  ariaLabel: string;
  /** Optional test-id passthrough; defaults to `list-skeleton`. */
  testId?: string;
}

/**
 * Category-aware list skeleton (P-19 / O-19). `card` variant renders
 * an outer rounded border plus 2-3 inner skeleton bars to match
 * card-shaped views (observations, lab values, open points). `row`
 * variant renders a single skeleton bar per item for compact list
 * shapes (supplements, timeline). The category-aware split keeps the
 * eventual content's layout stable: cards transition to cards, rows
 * to rows, no reflow when the data arrives.
 *
 * Wrapping `role="status"` + `aria-live="polite"` + caller-supplied
 * `aria-label` mean screen readers receive the same information they
 * got from the previous `Loading…` text indicator.
 */
export function ListSkeleton({
  count,
  variant,
  ariaLabel,
  testId = 'list-skeleton',
}: ListSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      data-testid={testId}
      className={variant === 'card' ? 'space-y-3' : 'space-y-2'}
    >
      {Array.from({ length: count }).map((_, i) =>
        variant === 'card' ? (
          <div
            key={i}
            data-testid={`${testId}-card`}
            className="rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
          >
            <Skeleton className="mb-2 h-4 w-1/3" />
            <Skeleton className="mb-2 h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ) : (
          <div key={i} data-testid={`${testId}-row`} className="flex items-center gap-3 py-2">
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ),
      )}
    </div>
  );
}
