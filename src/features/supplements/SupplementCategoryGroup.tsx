import { useMemo } from 'react';
import type { Supplement, SupplementCategory } from '../../domain';
import { findMatchRanges, splitQuery } from '../../lib';
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
   * P-22c: forwarded to each card for in-card highlighting AND used
   * to highlight the group label itself when the query matches the
   * category text.
   */
  highlightQuery?: string;
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
  highlightQuery,
}: SupplementCategoryGroupProps) {
  const terms = useMemo(
    () => (highlightQuery ? splitQuery(highlightQuery) : []),
    [highlightQuery],
  );
  if (supplements.length === 0) return null;

  const muted = category === 'paused';
  const headingId = `supplements-${category}-heading`;
  const labelRanges = terms.length === 0 ? [] : findMatchRanges(label, terms);

  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="mb-3 flex items-baseline gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        <span>
          {labelRanges.length > 0 ? (
            <HighlightedText
              text={label}
              ranges={labelRanges}
              startMatchIndex={0}
              activeMatchIndex={null}
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
              highlightQuery={highlightQuery}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
