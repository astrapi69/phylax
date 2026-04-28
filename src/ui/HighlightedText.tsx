import { Fragment } from 'react';
import type { MatchRange } from '../lib';

export interface HighlightedTextProps {
  /** Original text to render. Match indices in `ranges` index this string. */
  text: string;
  /** Sorted, non-overlapping match ranges within `text`. */
  ranges: MatchRange[];
  /** Global match index of the first range; subsequent ranges increment by one. */
  startMatchIndex: number;
  /** When set, the mark with this global index gets active styling. */
  activeMatchIndex?: number | null;
}

/**
 * Render a plain string with `<mark>` segments wrapped around each
 * supplied match range. Each mark carries `data-match-index="N"`
 * (sequential global counter starting at `startMatchIndex`) so the
 * active-match navigator can locate it in the DOM via
 * `document.querySelector` and scroll it into view.
 *
 * The active mark gets a distinct visual (orange/red) plus
 * `data-active="true"` and `aria-current="true"` for screen readers.
 * Background-color-only styling avoids any layout shift on highlight.
 *
 * Used for plain-text fields (theme heading). Markdown-rendered
 * fields go through `MarkdownContent` with a `highlightQuery` prop
 * which uses a rehype plugin to inject equivalent marks at the hast
 * text-node level while keeping Markdown formatting intact.
 */
export function HighlightedText({
  text,
  ranges,
  startMatchIndex,
  activeMatchIndex,
}: HighlightedTextProps) {
  if (ranges.length === 0) {
    return <>{text}</>;
  }

  const segments: React.ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    if (range === undefined) continue;
    if (range.start > cursor) {
      segments.push(<Fragment key={`t-${cursor}`}>{text.slice(cursor, range.start)}</Fragment>);
    }
    const globalIndex = startMatchIndex + i;
    const isActive = activeMatchIndex === globalIndex;
    segments.push(
      <mark
        key={`m-${globalIndex}`}
        data-match-index={globalIndex}
        data-active={isActive ? 'true' : undefined}
        aria-current={isActive ? 'true' : undefined}
        className={
          isActive
            ? 'rounded-sm bg-orange-300 px-0 text-gray-900 dark:bg-orange-500/80 dark:text-gray-900'
            : 'rounded-sm bg-yellow-200 px-0 text-gray-900 dark:bg-yellow-500/60 dark:text-gray-900'
        }
      >
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  }
  if (cursor < text.length) {
    segments.push(<Fragment key={`t-tail`}>{text.slice(cursor)}</Fragment>);
  }
  return <>{segments}</>;
}
