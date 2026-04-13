import type { ParsedSupplement } from '../types';
import type { SupplementCategory } from '../../../../domain';
import { parseMarkdownTable } from '../helpers/parseMarkdownTable';

const CATEGORY_MAP: Record<string, SupplementCategory> = {
  'beibehalten (taeglich)': 'daily',
  'beibehalten (t\u00e4glich)': 'daily',
  taeglich: 'daily',
  't\u00e4glich': 'daily',
};

const REGULAR_PATTERN = /beibehalten\s*\(\s*\d+-?\d*x?\s*\/?\s*woche\s*\)/i;

/**
 * Parse the supplements table into Supplement entities.
 *
 * Looks for a Markdown table with columns: Kategorie, Praeparat,
 * Empfehlung, Begruendung (or close variants).
 */
export function parseSupplements(content: string): ParsedSupplement[] {
  const rows = parseMarkdownTable(content);
  const supplements: ParsedSupplement[] = [];
  let lastCategory: SupplementCategory = 'daily';

  for (const row of rows) {
    const rawCategory = (row['Kategorie'] ?? row['kategorie'] ?? '').replace(/\*\*/g, '').trim();
    const rawPraeparat = (
      row['Praeparat'] ??
      row['Pr\u00e4parat'] ??
      row['praeparat'] ??
      ''
    ).trim();
    const recommendation = (row['Empfehlung'] ?? row['empfehlung'] ?? '').trim() || undefined;
    const rationale =
      (row['Begruendung'] ?? row['Begr\u00fcndung'] ?? row['begruendung'] ?? '').trim() ||
      undefined;

    if (!rawPraeparat) continue;

    // Parse category
    const parsedCat = parseCategory(rawCategory);
    const category: SupplementCategory = parsedCat ?? lastCategory;
    if (rawCategory && parsedCat) lastCategory = parsedCat;

    // Parse name + brand from "Name (Brand)" pattern
    const { name, brand } = parseNameBrand(rawPraeparat);

    supplements.push({
      name,
      brand,
      category,
      recommendation,
      rationale,
    });
  }

  return supplements;
}

function parseCategory(raw: string): SupplementCategory | null {
  if (!raw) return null;

  const lower = raw.toLowerCase();

  const exact = CATEGORY_MAP[lower];
  if (exact) return exact;

  if (REGULAR_PATTERN.test(raw)) return 'regular';
  if (/pausiert/i.test(raw)) return 'paused';
  if (/bei\s+bedarf/i.test(raw)) return 'on-demand';
  if (/beibehalten/i.test(raw)) return 'daily';

  return null;
}

function parseNameBrand(text: string): { name: string; brand?: string } {
  const match = /^(.+?)\s*\(([^)]+)\)\s*$/.exec(text);
  if (match) {
    return { name: (match[1] ?? '').trim(), brand: (match[2] ?? '').trim() };
  }
  return { name: text.trim() };
}
