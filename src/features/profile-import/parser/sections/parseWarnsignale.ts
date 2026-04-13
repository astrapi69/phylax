/**
 * Parse the Warnsignale section into a string array.
 *
 * Each bullet item becomes one warning sign.
 * Non-bullet content is ignored.
 */
export function parseWarnsignale(content: string): string[] {
  const signs: string[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    const match = /^[-*]\s+(.+)/.exec(trimmed);
    if (match?.[1]) {
      signs.push(match[1].trim());
    }
  }

  return signs;
}

/**
 * Parse the Externe Referenzen section into a string array.
 * Same bullet-list pattern as Warnsignale.
 */
export function parseExterneReferenzen(content: string): string[] {
  return parseWarnsignale(content); // identical structure
}
