import type { TimelineEntry } from '../../domain';
import { MarkdownContent } from '../profile-view';
import { SourceBadge } from '../observations';

interface TimelineEntryCardProps {
  entry: TimelineEntry;
}

/**
 * Single timeline entry: period as heading, title below, Markdown
 * body. Source badge only for non-user entries (SourceBadge handles
 * the conditional render).
 */
export function TimelineEntryCard({ entry }: TimelineEntryCardProps) {
  const { id, period, title, content, source } = entry;
  const headingId = `timeline-${id}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-sm border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
    >
      <header className="mb-3 border-b border-gray-200 pb-3 dark:border-gray-700">
        <h2 id={headingId} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {period}
        </h2>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{title}</p>
          <SourceBadge source={source} />
        </div>
      </header>
      <MarkdownContent>{content}</MarkdownContent>
    </section>
  );
}
