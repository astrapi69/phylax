import { useId } from 'react';

export interface DateRangeFilterProps {
  /** Current `from` value (ISO `YYYY-MM-DD`) or empty string for unbounded. */
  from: string;
  /** Current `to` value (ISO `YYYY-MM-DD`) or empty string for unbounded. */
  to: string;
  /** Called when the user picks or clears a `from` date. */
  onFromChange: (value: string) => void;
  /** Called when the user picks or clears a `to` date. */
  onToChange: (value: string) => void;
  /** Visible label text for the `from` input (e.g., "Von" / "From"). */
  fromLabel: string;
  /** Visible label text for the `to` input (e.g., "Bis" / "To"). */
  toLabel: string;
  /** ARIA label for the wrapping group (e.g., "Date range filter"). */
  groupAriaLabel: string;
  /** Optional test id passthrough; defaults to `date-range-filter`. */
  testId?: string;
}

/**
 * Shared date-range filter (O-18). Two native HTML5 `<input type="date">`
 * controls owned by the caller. Empty string on either side means
 * "no bound on that side"; the consumer is expected to keep state
 * in URLSearchParams so refresh / back / forward / shared-link all
 * round-trip the filtered view (matches the O-17 URL-as-state
 * convention).
 *
 * Why native: zero JS, zero bundle, native mobile picker, free a11y,
 * locale-aware display through the browser. Custom date pickers are
 * a recurring source of bundle bloat and a11y bugs.
 *
 * Layout: the two inputs sit side by side on >=sm viewports and stack
 * on smaller screens so the touch targets remain usable on phones.
 * The outer `<fieldset>` carries the group ARIA label so screen
 * readers announce both inputs as part of the same control.
 */
export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel,
  toLabel,
  groupAriaLabel,
  testId = 'date-range-filter',
}: DateRangeFilterProps) {
  const fromId = useId();
  const toId = useId();
  return (
    <fieldset
      aria-label={groupAriaLabel}
      data-testid={testId}
      className="m-0 flex flex-col gap-2 border-0 p-0 sm:flex-row sm:items-center sm:gap-3"
    >
      <label
        htmlFor={fromId}
        className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400"
      >
        <span>{fromLabel}</span>
        <input
          id={fromId}
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          data-testid={`${testId}-from`}
          className="rounded-sm border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus-visible:border-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </label>
      <label
        htmlFor={toId}
        className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400"
      >
        <span>{toLabel}</span>
        <input
          id={toId}
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          data-testid={`${testId}-to`}
          className="rounded-sm border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus-visible:border-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </label>
    </fieldset>
  );
}
