/**
 * A section of a Markdown document split by heading level.
 */
export interface Section {
  /** The heading text (without the # prefix) */
  heading: string;
  /** Heading level (2 for ##, 3 for ###, etc.) */
  level: number;
  /** Content below this heading until the next heading of same or higher level */
  content: string;
}

/**
 * Split Markdown into sections by heading.
 * Each section starts at a heading line and ends before the next heading
 * of the same or higher (lower number) level, or end of document.
 *
 * Content before the first heading is captured as a section with
 * heading="" and level=0.
 *
 * @param markdown - raw Markdown text
 * @param minLevel - minimum heading level to split on (default 2 for H2)
 */
export function splitIntoSections(markdown: string, minLevel: number = 2): Section[] {
  const lines = markdown.split('\n');
  const sections: Section[] = [];
  let currentHeading = '';
  let currentLevel = 0;
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    if (match) {
      const level = match[1]?.length ?? 0;
      const heading = match[2]?.trim() ?? '';

      if (level === minLevel) {
        // Save previous section
        sections.push({
          heading: currentHeading,
          level: currentLevel,
          content: currentLines.join('\n').trim(),
        });
        currentHeading = heading;
        currentLevel = level;
        currentLines = [];
        continue;
      }
    }
    currentLines.push(line);
  }

  // Save final section
  sections.push({
    heading: currentHeading,
    level: currentLevel,
    content: currentLines.join('\n').trim(),
  });

  return sections;
}
