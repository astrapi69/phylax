import { useCallback, useEffect, useId, useRef } from 'react';

/**
 * Shared search input. Single text input with an optional clear button
 * inside the right edge. Owned by the caller (controlled component);
 * `value` and `onChange` flow in from the parent.
 *
 * Established by O-17 (observation search). Lab values, supplements,
 * open points, etc. will reuse this when their search lands; the
 * component is feature-agnostic.
 *
 * A11y:
 * - `role="search"` wrapper turns the area into a landmark.
 * - Inner `<input type="search">` gets `role="searchbox"` semantics
 *   automatically and the browser's native clear UI on some platforms
 *   (we still render our own explicit clear button for cross-browser
 *   consistency and 44x44 touch target).
 * - `aria-label` is required from the caller (no default English
 *   string in this i18n-disciplined codebase).
 * - Escape inside the input clears the query and stays focused.
 * - Clear button is a 44x44 touch target per WCAG 2.5.5.
 */
export interface SearchInputProps {
  /** Current search query. */
  value: string;
  /** Called on every keystroke and on clear. */
  onChange: (value: string) => void;
  /** Placeholder text shown when the input is empty. */
  placeholder?: string;
  /** ARIA label for the input itself; mandatory for screen readers. */
  ariaLabel: string;
  /** Tooltip and ARIA label for the clear button. */
  clearLabel: string;
  /** Optional test id passthrough; defaults to `search-input`. */
  testId?: string;
  /** Called on Enter (no modifier). Used by P-19 for "next match". */
  onEnter?: () => void;
  /** Called on Shift+Enter. Used by P-19 for "previous match". */
  onShiftEnter?: () => void;
  /**
   * Called when the user presses Escape while the input is empty.
   * Used by P-22a icon-triggered search to collapse the bar back to
   * its trigger icon. Escape on a non-empty input still clears the
   * value first (does not invoke this callback).
   */
  onEscapeWhenEmpty?: () => void;
  /**
   * Auto-focus the input on mount. Used by P-22a icon-triggered
   * search to focus the input when the bar expands.
   */
  autoFocus?: boolean;
  /**
   * Override the X-button click. When provided, the X button calls
   * this instead of the default `onChange('') + refocus` behavior.
   * Used by P-22a two-stage search where the X is the global
   * clear-and-collapse action (clears search query AND date range
   * AND collapses the bar to its trigger icon). Escape on a
   * non-empty input still uses the default clear-and-focus path so
   * the standard Cmd+F semantic is preserved (first Escape clears
   * the input, second Escape collapses via `onEscapeWhenEmpty`).
   */
  onClear?: () => void;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  clearLabel,
  testId = 'search-input',
  onEnter,
  onShiftEnter,
  onEscapeWhenEmpty,
  autoFocus = false,
  onClear,
}: SearchInputProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const clear = useCallback(() => {
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  const handleClearClick = useCallback(() => {
    if (onClear) onClear();
    else clear();
  }, [onClear, clear]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        if (value !== '') {
          event.preventDefault();
          clear();
        } else if (onEscapeWhenEmpty) {
          event.preventDefault();
          onEscapeWhenEmpty();
        }
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) onShiftEnter?.();
        else onEnter?.();
      }
    },
    [clear, value, onEnter, onShiftEnter, onEscapeWhenEmpty],
  );

  return (
    <div role="search" className="relative w-full sm:max-w-xs">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500"
      >
        <SearchIcon />
      </span>
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        data-testid={testId}
        autoComplete="off"
        spellCheck={false}
        className="block w-full rounded-sm border border-gray-300 bg-white py-2 pr-10 pl-9 text-sm text-gray-900 placeholder-gray-400 focus-visible:border-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
      />
      {value !== '' && (
        <button
          type="button"
          onClick={handleClearClick}
          aria-label={clearLabel}
          title={clearLabel}
          data-testid={`${testId}-clear`}
          className="absolute inset-y-0 right-0 flex min-h-[44px] min-w-[44px] items-center justify-center text-gray-500 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ClearIcon />
        </button>
      )}
    </div>
  );
}

export function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708" />
    </svg>
  );
}
