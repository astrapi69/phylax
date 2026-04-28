/**
 * Strip Markdown formatting to plain text for PDF rendering. The PDF
 * export pipeline (X-02) does not yet render rich text; rich-text PDF
 * rendering is registered as P-21 polish. For v1 the goal is a
 * faithful plain-text representation that preserves the user's
 * content while dropping syntax markers.
 *
 * Supported transforms (regex-based; v1 accepts edge-case
 * imperfection like nested or escaped sequences):
 *
 * - Bold:      `**text**` / `__text__`     -> `text`
 * - Italic:    `*text*`   / `_text_`       -> `text`
 * - Strike:    `~~text~~`                  -> `text`
 * - Inline code: `` `code` ``              -> `code`
 * - Code fence: triple-backtick block      -> contents preserved, fences dropped
 * - Heading:   leading `#`/`##`/...        -> stripped, text preserved
 * - Blockquote: leading `>`                 -> stripped, text preserved
 * - Bullet:    leading `- ` / `* ` / `+ `  -> normalized to `- `
 * - Numbered:  leading `1. `, `2. `, ...   -> preserved as written
 * - Link:      `[text](url)`               -> `text (url)`
 * - Image:     `![alt](url)`               -> `[alt] (url)`
 * - HR:        `---` / `***` standalone    -> single newline
 *
 * Empty / whitespace-only input returns empty string.
 */
export function stripMarkdown(input: string): string {
  if (!input || input.trim() === '') return '';

  let s = input;

  // Code fences (triple-backtick): keep contents, drop fences. Match
  // opening fence + optional language + newline up to closing fence.
  s = s.replace(/```[a-zA-Z]*\n?([\s\S]*?)```/g, '$1');

  // Images (must precede links — share `[alt](url)` shape with leading `!`).
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '[$1] ($2)');

  // Links.
  s = s.replace(/\[([^\]]*)\]\(([^)]+)\)/g, '$1 ($2)');

  // Inline code.
  s = s.replace(/`([^`]+)`/g, '$1');

  // Bold (must precede italic; `**` and `__` are double-marker).
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/__([^_]+)__/g, '$1');

  // Italic.
  s = s.replace(/\*([^*\n]+)\*/g, '$1');
  s = s.replace(/_([^_\n]+)_/g, '$1');

  // Strikethrough.
  s = s.replace(/~~([^~]+)~~/g, '$1');

  // Headings: leading 1-6 `#` followed by space.
  s = s.replace(/^#{1,6}\s+/gm, '');

  // Blockquote markers.
  s = s.replace(/^>\s?/gm, '');

  // Horizontal rules: standalone `---` or `***` on a line by themselves.
  s = s.replace(/^[-*_]{3,}$/gm, '');

  // Normalize bullet markers (`*` and `+` -> `-`); preserve indentation.
  s = s.replace(/^(\s*)[*+](\s+)/gm, '$1-$2');

  // Collapse 3+ consecutive newlines to 2 to keep paragraph breaks
  // without leaving large empty blocks behind after fence/HR removal.
  s = s.replace(/\n{3,}/g, '\n\n');

  return s.trim();
}
