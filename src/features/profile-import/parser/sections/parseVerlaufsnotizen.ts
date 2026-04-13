import type { ParsedTimelineEntry } from '../types';
import { splitIntoSections } from '../helpers/splitIntoSections';

/**
 * Parse the Verlaufsnotizen (timeline entries) section.
 *
 * Each H3 sub-section becomes a TimelineEntry.
 * Heading is split on " - " into period and title.
 * Content is preserved as Markdown verbatim.
 */
export function parseVerlaufsnotizen(content: string): ParsedTimelineEntry[] {
  const subsections = splitIntoSections(content, 3);
  const entries: ParsedTimelineEntry[] = [];

  for (const sub of subsections) {
    if (sub.level === 0 || !sub.heading) continue;

    const heading = sub.heading.replace(/\s*\((?:NEU\s+)?v[\d.]+\)\s*/g, '').trim();
    const dashIndex = heading.indexOf(' - ');

    let period: string;
    let title: string;
    if (dashIndex !== -1) {
      period = heading.substring(0, dashIndex).trim();
      title = heading.substring(dashIndex + 3).trim();
    } else {
      period = heading;
      title = '';
    }

    entries.push({
      period,
      title,
      content: sub.content.trim(),
      source: 'user',
    });
  }

  return entries;
}
