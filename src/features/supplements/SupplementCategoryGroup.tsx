import type { Supplement, SupplementCategory } from '../../domain';
import type { FieldMatch, MatchPlan } from '../../lib';
import { HighlightedText } from '../../ui';
import { SupplementCard } from './SupplementCard';
import type { UseSupplementFormResult } from './useSupplementForm';

interface SupplementCategoryGroupProps {
  category: SupplementCategory;
  label: string;
  supplements: Supplement[];
  /** Threaded through to each `SupplementCard`. */
  form?: UseSupplementFormResult;
  /**
   * P-22b/c/d-polish-2: optional match plan from
   * `buildFieldMatchPlan` keyed by `cat:<category>:label` for the
   * group heading and `sup:<supplementId>:<field>` for each card.
   * When supplied, every rendered mark gets a sequential global
   * `data-match-index` so the view-level Up/Down nav can scroll per
   * mark. Read-only mounts that omit it render bare text.
   */
  matchPlan?: MatchPlan;
  /** Currently focused mark global index (1-based). */
  activeMatchIndex?: number | null;
}

/**
 * Section heading with count plus a list of supplement cards.
 * Renders nothing when the supplements list is empty.
 */
export function SupplementCategoryGroup({
  category,
  label,
  supplements,
  form,
  matchPlan,
  activeMatchIndex = null,
}: SupplementCategoryGroupProps) {
  if (supplements.length === 0) return null;

  const muted = category === 'paused';
  const headingId = `supplements-${category}-heading`;
  const labelMatch: FieldMatch | undefined = matchPlan?.get(`cat:${category}:label`);

  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="mb-3 flex items-baseline gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        <span>
          {labelMatch && labelMatch.ranges.length > 0 ? (
            <HighlightedText
              text={label}
              ranges={labelMatch.ranges}
              startMatchIndex={labelMatch.startIndex}
              activeMatchIndex={activeMatchIndex}
            />
          ) : (
            label
          )}
        </span>
        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
          ({supplements.length})
        </span>
      </h2>
      <ul className="space-y-2">
        {supplements.map((s) => (
          <li key={s.id}>
            <SupplementCard
              supplement={s}
              muted={muted}
              form={form}
              matchPlan={matchPlan}
              activeMatchIndex={activeMatchIndex}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
