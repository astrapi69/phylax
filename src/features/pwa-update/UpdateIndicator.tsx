import { useTranslation } from 'react-i18next';
import { useUpdate } from './UpdateContext';

/**
 * Header indicator for an installed-and-waiting SW update.
 *
 * Replaces the old bottom-of-viewport UpdatePrompt dialog (two-button
 * "Jetzt aktualisieren / Später" toast). Renders nothing when no
 * update is available; when the SW transitions to waiting state,
 * the provider sets `needRefresh=true` and this component surfaces a
 * compact pill (refresh icon + "Update" label) in the Header.
 *
 * Click cascade: `useUpdate().apply()` -> `updateSW(true)` ->
 * waiting SW activates and the page reloads. Reload kills the
 * in-memory keyStore so the user lands on `/unlock` afterwards;
 * that is intentional (any half-typed form is lost — accepted
 * trade-off; no auth state to migrate across builds).
 *
 * A11y:
 * - The pill mounts only when an update is available, so a single
 *   `role="status"` + `aria-live="polite"` announcement fires when
 *   it appears (not on every render).
 * - 44x44 minimum touch target per WCAG 2.5.5.
 * - aria-label spells out the action so the click target is not
 *   ambiguous to screen readers ("Update verfügbar — klicken zum
 *   Aktualisieren").
 */
export function UpdateIndicator() {
  const { t } = useTranslation('pwa-update');
  const { needRefresh, apply } = useUpdate();

  if (!needRefresh) return null;

  return (
    <div role="status" aria-live="polite">
      <button
        type="button"
        onClick={apply}
        aria-label={t('indicator.aria-label')}
        title={t('indicator.tooltip')}
        data-testid="update-indicator"
        className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400"
      >
        <RefreshIcon />
        <span>{t('indicator.label')}</span>
      </button>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
      <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466" />
    </svg>
  );
}
