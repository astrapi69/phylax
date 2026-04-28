import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { findMatchRanges, splitQuery } from '../../lib';

interface MarkdownContentProps {
  children: string | undefined | null;
  className?: string;
  /**
   * When non-empty, search-highlight the rendered Markdown by injecting
   * `<mark>` elements around matching substrings. Each mark carries
   * `data-match-index` starting at `startMatchIndex` and incrementing
   * left-to-right through the rendered text. Used by the observation
   * search (P-19).
   *
   * Match-discovery operates on the post-Markdown hast text nodes
   * (each text node is its own haystack), so formatting markers like
   * `**` are not part of the search content. This means the visible
   * highlight count may differ slightly from a source-level filter
   * count when the source text places match characters inside
   * Markdown syntax markers; the match counter uses the same hast
   * walk for consistency.
   */
  highlightQuery?: string;
  /** Sequential global index assigned to the first highlighted match. */
  startMatchIndex?: number;
  /** When set, the mark with this global index renders with active styling. */
  activeMatchIndex?: number | null;
}

/**
 * Single Markdown rendering wrapper for the whole app. Call sites
 * MUST go through this component rather than importing react-markdown
 * directly. See ADR-0008 for the rationale.
 *
 * HTML passthrough is not enabled. Raw HTML in the source renders as
 * text. Any future need for sanitized HTML passthrough requires a new
 * ADR and a dedicated rehype pipeline.
 *
 * Empty or whitespace-only content renders nothing so call sites can
 * pass optional fields without guards.
 *
 * P-19 search highlighting: when `highlightQuery` is supplied, an
 * inline rehype plugin walks the hast text nodes after Markdown
 * parsing and splits each value at matched ranges, replacing the
 * matched substring with a `<mark>` element. The plugin runs inside
 * the existing react-markdown pipeline, so Markdown formatting
 * (bold / italic / code / lists) is preserved while the matches get
 * yellow / orange highlights.
 */
export function MarkdownContent({
  children,
  className,
  highlightQuery,
  startMatchIndex = 0,
  activeMatchIndex,
}: MarkdownContentProps) {
  const content = typeof children === 'string' ? children : '';
  const terms = useMemo(() => (highlightQuery ? splitQuery(highlightQuery) : []), [highlightQuery]);

  const rehypePlugins = useMemo(() => {
    if (terms.length === 0) return undefined;
    return [() => makeHighlightTransformer(terms, startMatchIndex, activeMatchIndex)];
  }, [terms, startMatchIndex, activeMatchIndex]);

  if (content.trim() === '') return null;

  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert ${className ?? ''}`.trim()}>
      <ReactMarkdown rehypePlugins={rehypePlugins}>{content}</ReactMarkdown>
    </div>
  );
}

interface HastNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const ACTIVE_CLASS =
  'rounded-sm bg-orange-300 px-0 text-gray-900 dark:bg-orange-500/80 dark:text-gray-900';
const PASSIVE_CLASS =
  'rounded-sm bg-yellow-200 px-0 text-gray-900 dark:bg-yellow-500/60 dark:text-gray-900';

function makeHighlightTransformer(
  terms: string[],
  startMatchIndex: number,
  activeMatchIndex: number | null | undefined,
) {
  return (tree: HastNode): void => {
    let counter = startMatchIndex;
    walk(tree);

    function walk(node: HastNode): void {
      if (!node.children || node.children.length === 0) return;
      const next: HastNode[] = [];
      for (const child of node.children) {
        if (child.type === 'text' && typeof child.value === 'string' && child.value !== '') {
          const ranges = findMatchRanges(child.value, terms);
          if (ranges.length === 0) {
            next.push(child);
            continue;
          }
          let cursor = 0;
          for (const range of ranges) {
            if (range.start > cursor) {
              next.push({ type: 'text', value: child.value.slice(cursor, range.start) });
            }
            const globalIndex = counter;
            counter += 1;
            const isActive = activeMatchIndex === globalIndex;
            next.push({
              type: 'element',
              tagName: 'mark',
              properties: {
                'data-match-index': String(globalIndex),
                ...(isActive ? { 'data-active': 'true', 'aria-current': 'true' } : {}),
                className: isActive ? ACTIVE_CLASS : PASSIVE_CLASS,
              },
              children: [{ type: 'text', value: child.value.slice(range.start, range.end) }],
            });
            cursor = range.end;
          }
          if (cursor < child.value.length) {
            next.push({ type: 'text', value: child.value.slice(cursor) });
          }
        } else {
          walk(child);
          next.push(child);
        }
      }
      node.children = next;
    }
  };
}
