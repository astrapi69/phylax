import { useTranslation } from 'react-i18next';
import type { OpenPoint } from '../../domain';
import type { FieldMatch, MatchPlan } from '../../lib';
import { HighlightedText } from '../../ui';
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
   * contexts (e.g., profile-view summary panes) - checkbox stays
   * disabled and no actions render.
   */
  form?: UseOpenPointFormResult;
  /**
   * P-22d search query. Forwarded to `<MarkdownContent>` so the
   * rehype walk can find matches in the rendered hast text of the
   * `details` field (Markdown formatting markers are not in the
   * source-level scan, so MarkdownContent does its own walk). For
   * plain-text fields the matchPlan ranges drive highlights instead.
   */
  highlightQuery?: string;
  /**
   * P-22b/c/d-polish-2: optional match plan keyed by
   * `op:<itemId>:<field>`. Provides per-field range + startIndex
   * for plain-text fields (text, priority, timeHorizon) and the
   * starting global index for the Markdown details field. When
   * omitted, the item renders bare text and forwards
   * `highlightQuery` to MarkdownContent with `startMatchIndex=0`.
   */
  matchPlan?: MatchPlan;
  /** Currently focused mark global index (1-based). */
  activeMatchIndex?: number | null;
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
export function OpenPointItem({
  point,
  form,
  highlightQuery,
  matchPlan,
  activeMatchIndex = null,
}: OpenPointItemProps) {
  const { t } = useTranslation('open-points');
  const { id, text, resolved, priority, timeHorizon, details } = point;
  const lookup = (field: string): FieldMatch | undefined => matchPlan?.get(`op:${id}:${field}`);
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
                <HighlightCell
                  text={text}
                  fieldMatch={lookup('text')}
                  activeMatchIndex={activeMatchIndex}
                />
              </span>
              {priority && (
                <Badge>
                  <HighlightCell
                    text={priority}
                    fieldMatch={lookup('priority')}
                    activeMatchIndex={activeMatchIndex}
                  />
                </Badge>
              )}
              {timeHorizon && (
                <Badge>
                  <HighlightCell
                    text={timeHorizon}
                    fieldMatch={lookup('timeHorizon')}
                    activeMatchIndex={activeMatchIndex}
                  />
                </Badge>
              )}
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
              <MarkdownContent
                highlightQuery={highlightQuery}
                startMatchIndex={lookup('details')?.startIndex ?? 0}
                activeMatchIndex={activeMatchIndex}
              >
                {details}
              </MarkdownContent>
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

function HighlightCell({
  text,
  fieldMatch,
  activeMatchIndex,
}: {
  text: string;
  fieldMatch: FieldMatch | undefined;
  activeMatchIndex: number | null;
}) {
  if (!fieldMatch || fieldMatch.ranges.length === 0) return <>{text}</>;
  return (
    <HighlightedText
      text={text}
      ranges={fieldMatch.ranges}
      startMatchIndex={fieldMatch.startIndex}
      activeMatchIndex={activeMatchIndex}
    />
  );
}
