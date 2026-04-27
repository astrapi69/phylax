import { useTranslation } from 'react-i18next';
import type { OpenPoint } from '../../domain';
import { MarkdownContent } from '../profile-view';
import { ProvenanceBadge } from '../document-import/ui/ProvenanceBadge';
import { OpenPointActions } from './OpenPointActions';
import type { UseOpenPointFormResult } from './useOpenPointForm';

interface OpenPointItemProps {
  point: OpenPoint;
  /**
   * Optional form-state hook result. When supplied, the checkbox
   * becomes interactive (toggles `resolved`) and an edit/delete
   * cluster renders next to the item title. Omitted in read-only
   * contexts (e.g., profile-view summary panes) — checkbox stays
   * disabled and no actions render.
   */
  form?: UseOpenPointFormResult;
}

/**
 * Single open point display. When a `form` prop is supplied the
 * checkbox toggles `resolved` via the hook's `toggle()` fast-path,
 * and an edit + delete actions cluster trails the title row.
 *
 * Resolved items use a subtle gray tint + "Erledigt" badge for
 * muted visual signal without opacity (see V-04 a11y finding).
 * Strikethrough text on resolved items is the standard checklist
 * convention.
 */
export function OpenPointItem({ point, form }: OpenPointItemProps) {
  const { t } = useTranslation('open-points');
  const { id, text, resolved, priority, timeHorizon, details } = point;
  const containerClass = resolved
    ? 'rounded-sm border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50'
    : 'rounded-sm border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800';
  const textId = `open-point-${id}-text`;
  const isToggling = form?.togglingId === id;
  const checkboxDisabled = !form || isToggling;

  return (
    <div className={containerClass}>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={resolved}
          disabled={checkboxDisabled}
          onChange={() => {
            if (form && !isToggling) void form.toggle(point);
          }}
          aria-labelledby={textId}
          className="mt-0.5 h-4 w-4 accent-blue-600 disabled:cursor-not-allowed"
          data-testid={`open-point-toggle-${id}`}
        />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
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
              <ProvenanceBadge sourceDocumentId={point.sourceDocumentId} />
            </div>
            {form ? <OpenPointActions point={point} form={form} /> : null}
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
