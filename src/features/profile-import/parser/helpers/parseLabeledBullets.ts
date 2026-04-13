/**
 * A labeled bullet extracted from Markdown.
 * Pattern: `- **Label:** value` or `**Label:** value`
 */
export interface LabeledBullet {
  label: string;
  value: string;
}

/**
 * Extract labeled bullets from Markdown content.
 *
 * Recognizes patterns like:
 * - `- **Label:** value text`
 * - `**Label:** value text`
 * - `- **Label**: value text` (colon outside bold)
 *
 * Multi-line values: captures everything until the next labeled bullet
 * or end of input. Preserves Markdown formatting in values.
 */
export function parseLabeledBullets(markdown: string): LabeledBullet[] {
  const results: LabeledBullet[] = [];
  const lines = markdown.split('\n');

  // Pattern: optional "- " prefix, then **Label:** or **Label**:
  const bulletPattern = /^(?:-\s+)?\*\*([^*]+)\*\*:?\s*(.*)/;

  let currentLabel: string | null = null;
  let currentValueLines: string[] = [];

  for (const line of lines) {
    const match = bulletPattern.exec(line);
    if (match) {
      // Save previous bullet if any
      if (currentLabel !== null) {
        results.push({
          label: currentLabel,
          value: currentValueLines.join('\n').trim(),
        });
      }
      currentLabel = (match[1] ?? '').trim().replace(/:$/, '');
      currentValueLines = [(match[2] ?? '').trim()];
    } else if (currentLabel !== null) {
      // Continuation line for current bullet
      currentValueLines.push(line);
    }
  }

  // Save final bullet
  if (currentLabel !== null) {
    results.push({
      label: currentLabel,
      value: currentValueLines.join('\n').trim(),
    });
  }

  return results;
}
