/**
 * Password / secret visibility toggle button.
 *
 * Mounts inside a `relative` wrapper next to a password-type `<input>`,
 * positioned to the right edge via `absolute inset-y-0 right-0`.
 * Parent input must have `pr-10` (or wider) to keep the input text clear
 * of the toggle.
 *
 * Touch target: 44×44px minimum per WCAG 2.5.5 (matches the project
 * a11y discipline established in O-10..O-14). `min-h-[44px]` may
 * cause the toggle to overflow short input wrappers slightly — that's
 * the trade-off accepted here over fighting `inset-y-0` positioning.
 *
 * Focus management: `onMouseDown={preventDefault}` keeps focus inside
 * the password input when the toggle is clicked with a mouse, so the
 * user can keep typing without re-focusing. Keyboard Tab navigation is
 * unaffected (focus reaches the button as a normal tab stop).
 *
 * Labels: caller supplies localized `labelShow` / `labelHide` strings.
 * Component is namespace-agnostic; consumers translate via their own
 * `t()` calls. Master-password contexts pass "Passwort anzeigen /
 * verbergen"; AI API key contexts pass "API-Key anzeigen / verbergen".
 *
 * `aria-pressed` reflects the visible state for screen readers (NVDA,
 * JAWS announce pressed-state on toggle buttons). Inline SVG (no icon
 * library) per project bundle hygiene rules.
 */
export interface PasswordVisibilityToggleProps {
  /** True when password text is currently revealed. */
  visible: boolean;
  /** Click / activation handler — caller flips `visible` state. */
  onToggle: () => void;
  /** aria-label and `title` text when password is hidden. */
  labelShow: string;
  /** aria-label and `title` text when password is visible. */
  labelHide: string;
  /** Disabled state propagates from the password input (rate-limit, submit-in-flight). */
  disabled?: boolean;
}

export function PasswordVisibilityToggle({
  visible,
  onToggle,
  labelShow,
  labelHide,
  disabled,
}: PasswordVisibilityToggleProps) {
  const label = visible ? labelHide : labelShow;
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseDown={(e) => {
        // Prevent focus shift away from the password input on mouse click.
        // Keyboard activation (Tab + Enter/Space) is unaffected.
        e.preventDefault();
      }}
      disabled={disabled}
      aria-label={label}
      aria-pressed={visible}
      title={label}
      data-testid="password-visibility-toggle"
      className="absolute inset-y-0 right-0 flex min-h-[44px] min-w-[44px] items-center justify-center text-gray-500 hover:text-gray-700 focus:text-gray-700 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-200 dark:focus:text-gray-200 dark:focus-visible:ring-offset-gray-900"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
        {visible && <line x1="4" y1="4" x2="20" y2="20" />}
      </svg>
    </button>
  );
}
