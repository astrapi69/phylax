import { useTranslation } from 'react-i18next';
import type { OpenPoint } from '../../domain';
import { MarkdownContent } from '../profile-view';

interface OpenPointItemProps {
  point: OpenPoint;
}

/**
 * Single open point display. Checkbox is read-only (disabled) in
 * this view; the toggle-to-resolve interaction belongs to a future
 * E-series edit task.
 *
 * Resolved items use a subtle gray tint + "Erledigt" badge for
 * muted visual signal without opacity (see V-04 a11y finding).
 */
export function OpenPointItem({ point }: OpenPointItemProps) {
  const { t } = useTranslation('open-points');
  const { id, text, resolved, priority, timeHorizon, details } = point;
  const containerClass = resolved
    ? 'rounded-sm border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50'
    : 'rounded-sm border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800';
  const textId = `open-point-${id}-text`;

  return (
    <div className={containerClass}>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={resolved}
          disabled
          aria-labelledby={textId}
          className="mt-0.5 h-4 w-4 accent-blue-600"
        />
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span
              id={textId}
              className={
                resolved
                  ? 'text-sm text-gray-600 line-through dark:text-gray-400'
                  : 'text-sm text-gray-900 dark:text-gray-100'
              }
            >
              {text}
            </span>
            {priority && <Badge>{priority}</Badge>}
            {timeHorizon && <Badge>{timeHorizon}</Badge>}
            {resolved && (
              <span className="rounded-sm bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                {t('item.resolved-badge')}
              </span>
            )}
          </div>
          {details && details.trim() !== '' && (
            <div className="mt-2 pl-0">
              <MarkdownContent>{details}</MarkdownContent>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      {children}
    </span>
  );
}
