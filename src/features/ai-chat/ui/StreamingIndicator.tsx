import { useTranslation } from 'react-i18next';

/**
 * Three pulsing dots shown while an assistant message is mid-stream.
 * Presentational only; the parent decides when to render it.
 *
 * The dots have `aria-hidden` so they do not clutter screen readers; the
 * status is announced separately via the chat's live-region container.
 */
export function StreamingIndicator() {
  const { t } = useTranslation('ai-chat');
  return (
    <span
      className="inline-flex items-center gap-1"
      role="status"
      aria-label={t('streaming.aria-label')}
      data-testid="streaming-indicator"
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.3s] dark:bg-gray-400"
      />
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.15s] dark:bg-gray-400"
      />
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 dark:bg-gray-400"
      />
    </span>
  );
}
