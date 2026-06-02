import type { jsPDF as JsPdfType } from 'jspdf';
import { FONT_FAMILY } from './typography';

/**
 * Rich-text renderer for the PDF export (X-09 Phase 2).
 *
 * Walks a markdown-flavoured string and emits styled runs onto a
 * jsPDF document, advancing a y cursor and honouring a per-line page-
 * break check. Supported markup:
 *
 * - `**bold**` / `__bold__`            inline bold
 * - `*italic*` / `_italic_`            inline italic (single-line only)
 * - Blank line                          paragraph break
 * - `- ` / `* ` / `+ ` line prefix      bullet item with hanging indent
 *
 * Unsupported (stripped, contents preserved): headings, blockquotes,
 * code fences, inline code, links, images, horizontal rules. The
 * driver intentionally narrower than `react-markdown`; the goal is a
 * useful subset that covers ~95% of what users actually type in
 * observation / supplement fields, not full CommonMark.
 *
 * Line wrap is greedy by word; each rendered line is checked against
 * the caller-provided `ensureSpace` so the cursor moves to a fresh
 * page mid-block without splitting a word.
 */

type Style = 'normal' | 'bold' | 'italic' | 'bolditalic';

interface Run {
  text: string;
  style: Style;
}

export interface RichBlock {
  kind: 'paragraph' | 'bullet';
  runs: Run[];
}

const BULLET_PREFIX = '- ';
const BULLET_INDENT_MM = 4;

/**
 * Compose blocks for a `"Label: value"` row where the label is bold
 * and the value is parsed as rich text. The label prefix only attaches
 * to the first block of the parsed body; subsequent paragraphs and
 * bullets render as a continuation block beneath. Returns an empty
 * array for an empty body, so callers can `if (!blocks.length) skip`.
 */
export function composeFieldBlocks(label: string, body: string): RichBlock[] {
  const parsed = parseRichText(body);
  const [first, ...rest] = parsed;
  if (!first) return [];
  return [
    {
      kind: first.kind,
      runs: [{ text: `${label}: `, style: 'bold' }, ...first.runs],
    },
    ...rest,
  ];
}

export function parseRichText(input: string): RichBlock[] {
  if (!input || input.trim() === '') return [];

  let s = input;
  // Strip unsupported syntax but keep the textual contents.
  s = s.replace(/```[a-zA-Z]*\n?([\s\S]*?)```/g, '$1');
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  s = s.replace(/^#{1,6}\s+/gm, '');
  s = s.replace(/^>\s?/gm, '');
  s = s.replace(/^[-*_]{3,}$/gm, '');

  const rawBlocks = s.split(/\n{2,}/);
  const blocks: RichBlock[] = [];
  for (const raw of rawBlocks) {
    const lines = raw.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const bulletMatch = /^[-*+]\s+(.*)$/.exec(trimmed);
      if (bulletMatch) {
        blocks.push({ kind: 'bullet', runs: parseInline(bulletMatch[1] ?? '') });
      } else {
        blocks.push({ kind: 'paragraph', runs: parseInline(trimmed) });
      }
    }
  }
  return blocks;
}

function parseInline(text: string): Run[] {
  const runs: Run[] = [];
  let bold = false;
  let italic = false;
  let buf = '';
  const flush = () => {
    if (buf) {
      runs.push({ text: buf, style: pickStyle(bold, italic) });
      buf = '';
    }
  };
  let i = 0;
  while (i < text.length) {
    const c = text[i] ?? '';
    const two = text.substring(i, i + 2);
    if (two === '**' || two === '__') {
      flush();
      bold = !bold;
      i += 2;
      continue;
    }
    if (c === '*' || c === '_') {
      flush();
      italic = !italic;
      i += 1;
      continue;
    }
    buf += c;
    i += 1;
  }
  flush();
  return runs.filter((r) => r.text !== '');
}

function pickStyle(bold: boolean, italic: boolean): Style {
  if (bold && italic) return 'bolditalic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'normal';
}

function setStyle(doc: JsPdfType, style: Style, fontSize: number): void {
  doc.setFont(FONT_FAMILY, style);
  doc.setFontSize(fontSize);
}

interface RichLine {
  runs: Run[];
}

/**
 * Greedy word-wrap across styled runs. Tokens are words and
 * intra-run whitespace; whitespace at a line-break boundary is
 * dropped so the next line starts flush-left.
 */
function layoutRuns(
  doc: JsPdfType,
  runs: readonly Run[],
  maxWidth: number,
  fontSize: number,
): RichLine[] {
  const lines: RichLine[] = [];
  let current: Run[] = [];
  let currentWidth = 0;

  const flush = () => {
    if (current.length > 0) {
      // Drop trailing whitespace-only run so right edge is tight.
      let tail = current[current.length - 1];
      while (tail && /^\s+$/.test(tail.text)) {
        current.pop();
        tail = current[current.length - 1];
      }
      if (current.length > 0) lines.push({ runs: mergeAdjacent(current) });
      current = [];
      currentWidth = 0;
    }
  };

  for (const run of runs) {
    setStyle(doc, run.style, fontSize);
    for (const tok of splitTokens(run.text)) {
      setStyle(doc, run.style, fontSize);
      const w = doc.getTextWidth(tok);
      if (currentWidth + w > maxWidth && currentWidth > 0) {
        flush();
        if (/^\s+$/.test(tok)) continue;
      }
      current.push({ text: tok, style: run.style });
      currentWidth += w;
    }
  }
  flush();
  return lines;
}

function splitTokens(text: string): string[] {
  // Split into alternating word + whitespace tokens, preserving order.
  const out: string[] = [];
  let buf = '';
  let inWs = false;
  for (const ch of text) {
    const wsNow = /\s/.test(ch);
    if (buf === '' || wsNow === inWs) {
      buf += ch;
      inWs = wsNow;
    } else {
      out.push(buf);
      buf = ch;
      inWs = wsNow;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function mergeAdjacent(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last && last.style === r.style) {
      last.text += r.text;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

export interface RenderRichTextOptions {
  x: number;
  y: number;
  maxWidth: number;
  fontSize: number;
  /** Vertical advance per line, mm. */
  leading: number;
  /** Vertical gap between paragraphs / bullets, mm. */
  blockGap: number;
  /** Called before each line is emitted; may move the cursor to a new
   *  page. Receives `(currentY, neededY)` and returns the y to draw at. */
  ensureSpace: (y: number, needed: number) => number;
}

export function renderRichText(
  doc: JsPdfType,
  blocks: readonly RichBlock[],
  opts: RenderRichTextOptions,
): number {
  let y = opts.y;
  for (const [bi, block] of blocks.entries()) {
    const indent = block.kind === 'bullet' ? BULLET_INDENT_MM : 0;
    const runs: Run[] =
      block.kind === 'bullet'
        ? [{ text: BULLET_PREFIX, style: 'normal' }, ...block.runs]
        : [...block.runs];

    const lines = layoutRuns(doc, runs, opts.maxWidth - indent, opts.fontSize);
    for (const [li, line] of lines.entries()) {
      y = opts.ensureSpace(y, opts.leading);
      const xStart = opts.x + (li === 0 ? 0 : indent);
      renderLine(doc, line, xStart, y, opts.fontSize);
      y += opts.leading;
    }
    if (bi < blocks.length - 1) y += opts.blockGap;
  }
  return y;
}

function renderLine(doc: JsPdfType, line: RichLine, x: number, y: number, fontSize: number): void {
  let cursor = x;
  for (const run of line.runs) {
    setStyle(doc, run.style, fontSize);
    doc.text(run.text, cursor, y);
    cursor += doc.getTextWidth(run.text);
  }
}
