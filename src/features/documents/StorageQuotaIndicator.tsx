import { useTranslation } from 'react-i18next';
import { useStorageQuota } from './useStorageQuota';

export interface StorageQuotaIndicatorProps {
  /**
   * Caller-owned refetch trigger. Bump on upload/delete to re-read
   * the quota estimate.
   */
  versionKey?: number;
}

/** Warning tier: informational at 70%, actionable at 90%. */
const WARNING_MEDIUM_THRESHOLD = 70;
const WARNING_HIGH_THRESHOLD = 90;

const BINARY_KB = 1024;
const BINARY_MB = BINARY_KB * 1024;
const BINARY_GB = BINARY_MB * 1024;

/**
 * Small progress bar + usage text below the documents list. Renders
 * nothing when the browser API is unavailable or throws — the
 * indicator is an optional signal, not a required UI element.
 *
 * Accessibility:
 * - Outer container has `role="progressbar"` + aria-valuenow /
 *   aria-valuemin / aria-valuemax / aria-valuetext, so screen
 *   readers announce the human-readable usage string.
 * - Inner (filled) div carries `aria-hidden="true"` because it is
 *   pure visual decoration; without this, some screen readers
 *   describe both the outer role and the inner element, causing
 *   double-announcement of the same state.
 * - Warning text gets `role="status"` so it is announced when it
 *   first appears (transition from below threshold to at/above).
 */
export function StorageQuotaIndicator({ versionKey }: StorageQuotaIndicatorProps) {
  const { t } = useTranslation('documents');
  const state = useStorageQuota({ versionKey });

  // `unavailable` and `error` render the same: nothing. The `error`
  // detail stays in the hook state for test assertions and dev
  // tooling; end users see silence because a string like "Security
  // error: access denied" is not actionable information.
  if (state.kind !== 'loaded') return null;

  const { usageBytes, quotaBytes, percent } = state;
  const usageLabel = formatBytes(usageBytes);
  const quotaLabel = formatBytes(quotaBytes);
  const fullText = t('quota.usage', {
    usage: usageLabel,
    quota: quotaLabel,
    percent,
  });

  const tier =
    percent >= WARNING_HIGH_THRESHOLD
      ? 'high'
      : percent >= WARNING_MEDIUM_THRESHOLD
        ? 'medium'
        : 'low';

  const barColor =
    tier === 'high'
      ? 'bg-red-600 dark:bg-red-500'
      : tier === 'medium'
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-green-600 dark:bg-green-500';

  return (
    <section
      aria-label={t('quota.heading')}
      className="mt-4 flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800"
      data-testid="storage-quota-indicator"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-gray-900 dark:text-gray-100">{t('quota.heading')}</span>
        <span className="text-xs text-gray-600 dark:text-gray-400" data-testid="quota-usage-text">
          {fullText}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t('quota.heading')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={fullText}
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
        data-testid="quota-progressbar"
        data-tier={tier}
      >
        <div
          aria-hidden
          className={`h-full transition-[width] ${barColor}`}
          style={{ width: `${percent}%` }}
          data-testid="quota-bar-fill"
        />
      </div>
      {tier === 'medium' && (
        <p
          role="status"
          className="text-xs text-amber-700 dark:text-amber-400"
          data-testid="quota-warning-medium"
        >
          {t('quota.warning-medium')}
        </p>
      )}
      {tier === 'high' && (
        <p
          role="status"
          className="text-xs text-red-700 dark:text-red-400"
          data-testid="quota-warning-high"
        >
          {t('quota.warning-high')}
        </p>
      )}
    </section>
  );
}

/**
 * Format a byte count in binary units. Threshold picked per unit so
 * the integer portion stays readable: `123 KB`, `45 MB`, `2.3 GB`.
 * Sub-MB values drop decimals; GB keeps one decimal for resolution
 * at the scale users care about.
 */
function formatBytes(bytes: number): string {
  if (bytes < BINARY_KB) return `${bytes} B`;
  if (bytes < BINARY_MB) return `${Math.round(bytes / BINARY_KB)} KB`;
  if (bytes < BINARY_GB) return `${Math.round(bytes / BINARY_MB)} MB`;
  return `${(bytes / BINARY_GB).toFixed(1)} GB`;
}
