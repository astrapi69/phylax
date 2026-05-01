import type { OpenPoint } from '../../domain';
import type { FieldMatch, MatchPlan } from '../../lib';
import { HighlightedText } from '../../ui';
import { OpenPointItem } from './OpenPointItem';
import type { UseOpenPointFormResult } from './useOpenPointForm';

interface ContextGroupProps {
  context: string;
  items: OpenPoint[];
  /** Threaded through to each `OpenPointItem`. */
  form?: UseOpenPointFormResult;
  /**
   * P-22d search query. Forwarded to OpenPointItem so the markdown
   * `details` field can run its rehype highlight walk.
   */
  highlightQuery?: string;
  /**
   * P-22b/c/d-polish-2: optional match plan from
   * `buildFieldMatchPlan` keyed by `ctx:<context>:label` for the
   * heading and `op:<itemId>:<field>` for each item cell. When
   * supplied, every rendered mark gets a sequential global
   * `data-match-index` so the view-level Up/Down nav can scroll per
   * mark. Read-only mounts that omit it render bare text.
   */
  matchPlan?: MatchPlan;
  /** Currently focused mark global index (1-based). */
  activeMatchIndex?: number | null;
}

/**
 * Section heading with count plus a list of open point items.
 * Renders nothing when the items list is empty.
 */
export function ContextGroup({
  context,
  items,
  form,
  highlightQuery,
  matchPlan,
  activeMatchIndex = null,
}: ContextGroupProps) {
  if (items.length === 0) return null;

  const headingId = `context-${slugify(context)}-heading`;
  const labelMatch: FieldMatch | undefined = matchPlan?.get(`ctx:${context}:label`);

  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="mb-3 flex items-baseline gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        <span>
          {labelMatch && labelMatch.ranges.length > 0 ? (
            <HighlightedText
              text={context}
              ranges={labelMatch.ranges}
              startMatchIndex={labelMatch.startIndex}
              activeMatchIndex={activeMatchIndex}
            />
          ) : (
            context
          )}
        </span>
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
          ({items.length})
        </span>
      </h2>
      <ul className="space-y-2">
        {items.map((p) => (
          <li key={p.id}>
            <OpenPointItem
              point={p}
              form={form}
              highlightQuery={highlightQuery}
              matchPlan={matchPlan}
              activeMatchIndex={activeMatchIndex}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
