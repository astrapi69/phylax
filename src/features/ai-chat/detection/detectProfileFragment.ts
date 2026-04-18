/**
 * Detect a Phylax profile-format fragment inside an AI message body.
 *
 * The AI is instructed (via PROFILE_OUTPUT_FORMAT in the system prompt)
 * to emit new observations, lab values, supplements, and open points in a
 * Markdown shape the existing IM-01 parser can read. This module scans
 * raw AI output for those shapes and returns the structured blocks so the
 * chat UI can offer an "In Profil uebernehmen" preview.
 *
 * Detection is intentionally conservative:
 * - A bare `### Heading` is ignored unless the body contains at least one
 *   of the four observation field markers (Status / Beobachtung / Muster
 *   / Selbstregulation). This prevents false positives on any `###`
 *   heading the AI might use in conversation.
 * - Level-2 sections are matched by exact heading text (with the parser's
 *   Blutwerte/Blutbild aliases for Laborwerte).
 * - Content inside triple-backtick code fences is inspected too; fences
 *   are stripped before scanning.
 */

export interface DetectedFragment {
  /** Markdown assembled from all matched blocks (for preview + wrapping). */
  markdown: string;
  /** Each `### Theme` block with its field bullets, verbatim. */
  observationBlocks: string[];
  /** Full "## Supplemente ..." section text (including Markdown table), or null. */
  supplementsBlock: string | null;
  /** Full "## Offene Punkte ..." section text, or null. */
  openPointsBlock: string | null;
  hasObservations: boolean;
  hasSupplements: boolean;
  hasOpenPoints: boolean;
}

// Matches the IM-01 parser's labeled-bullet pattern: `- **Label:**` or
// `- **Label**:`. The bold syntax is mandatory because parseLabeledBullets
// only recognizes bold labels.
const OBSERVATION_FIELD =
  /^\s*(?:-\s+)?\*\*(?:Status|Beobachtung|Muster|Selbstregulation)(?:\s*\*\*)?\s*:/i;
const SUPPLEMENTS_HEADING = /^##\s+Supplemente\b/i;
const OPEN_POINTS_HEADING = /^##\s+Offene\s+Punkte\b/i;
const LEVEL2_HEADING = /^##\s+/;
const LEVEL3_HEADING = /^###\s+(.+?)\s*$/;
const BULLET = /^\s*[-*+]\s/;
const HEADING = /^#{1,4}\s/;
const TABLE_ROW = /^\s*\|/;
const INDENTED = /^\s/;

/**
 * Decide whether a line is part of a structured content block as opposed
 * to trailing conversational prose. Blank lines, bullets, headings, table
 * rows, and indented continuations all count as content. Anything else
 * (a standalone sentence like "Moechtest du das uebernehmen?") terminates
 * the surrounding block.
 */
function isContentLine(line: string): boolean {
  if (line.trim().length === 0) return true;
  if (BULLET.test(line)) return true;
  if (HEADING.test(line)) return true;
  if (TABLE_ROW.test(line)) return true;
  if (INDENTED.test(line)) return true;
  return false;
}

/**
 * Return a DetectedFragment if the message contains recognizable profile
 * format, otherwise null.
 *
 * Laborwerte are intentionally out of scope: the IM-01 parser requires
 * `### Befund vom <date>` sub-sections plus per-category Markdown tables,
 * which an AI chat cannot reliably produce. Lab values are imported via
 * the dedicated bulk-import flow instead.
 */
export function detectProfileFragment(message: string): DetectedFragment | null {
  if (!message || message.length === 0) return null;

  const cleaned = stripCodeFences(message);
  const lines = cleaned.split('\n');

  const observationBlocks = extractObservationBlocks(lines);
  const supplementsBlock = extractLevel2Block(lines, SUPPLEMENTS_HEADING);
  const openPointsBlock = extractLevel2Block(lines, OPEN_POINTS_HEADING);

  const hasObservations = observationBlocks.length > 0;
  const hasSupplements = supplementsBlock !== null;
  const hasOpenPoints = openPointsBlock !== null;

  if (!hasObservations && !hasSupplements && !hasOpenPoints) {
    return null;
  }

  const markdown = assembleMarkdown(observationBlocks, supplementsBlock, openPointsBlock);

  return {
    markdown,
    observationBlocks,
    supplementsBlock,
    openPointsBlock,
    hasObservations,
    hasSupplements,
    hasOpenPoints,
  };
}

/**
 * Strip triple-backtick code fences, keeping the inner content inline so
 * the scanner treats fenced profile blocks the same as unfenced ones.
 */
function stripCodeFences(text: string): string {
  return text.replace(/```[^\n]*\n([\s\S]*?)(?:```|$)/g, '$1');
}

/**
 * Scan for `### Theme` headings whose body contains at least one of the
 * four observation field markers. Returns each qualifying block verbatim.
 */
function extractObservationBlocks(lines: string[]): string[] {
  const blocks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const heading = line && LEVEL3_HEADING.exec(line);
    if (!heading) {
      i += 1;
      continue;
    }
    // Collect body lines until the next heading (any level), trailing
    // conversational prose, or EOF.
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (!next && next !== '') break;
      if (LEVEL3_HEADING.test(next) || /^#{1,2}\s+/.test(next)) break;
      if (!isContentLine(next)) break;
      j += 1;
    }
    const body = trimTrailingBlanks(lines.slice(i + 1, j));
    const hasField = body.some((l) => OBSERVATION_FIELD.test(l));
    if (hasField) {
      blocks.push([line, ...body].join('\n'));
    }
    i = j;
  }
  return blocks;
}

/**
 * Extract a level-2 section (`## ...`) whose heading matches the given
 * pattern, including everything up to the next level-2 heading or EOF.
 * Returns null when the section is absent or has no content.
 */
function extractLevel2Block(lines: string[], headingPattern: RegExp): string | null {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || !headingPattern.test(line)) continue;

    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (!next && next !== '') break;
      if (LEVEL2_HEADING.test(next) && !headingPattern.test(next)) break;
      if (!isContentLine(next)) break;
      j += 1;
    }
    const body = trimTrailingBlanks(lines.slice(i + 1, j));
    const hasBody = body.some((l) => l.trim().length > 0);
    if (!hasBody) return null;
    return [line, ...body].join('\n');
  }
  return null;
}

function trimTrailingBlanks(lines: string[]): string[] {
  const out = [...lines];
  while (out.length > 0 && (out[out.length - 1] ?? '').trim().length === 0) {
    out.pop();
  }
  return out;
}

function assembleMarkdown(
  observationBlocks: string[],
  supplementsBlock: string | null,
  openPointsBlock: string | null,
): string {
  const parts: string[] = [];
  if (observationBlocks.length > 0) {
    parts.push('## Beobachtungen');
    parts.push(observationBlocks.join('\n\n'));
  }
  if (supplementsBlock) parts.push(supplementsBlock);
  if (openPointsBlock) parts.push(openPointsBlock);
  return parts.join('\n\n');
}
