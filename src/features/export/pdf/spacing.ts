/**
 * Spacing tokens for the PDF export (X-09). All values in mm; the
 * jsPDF document is configured with `unit: 'mm'`.
 *
 * `Margin` is the outer page frame; section renderers must keep their
 * content within `[Margin.page, page-width - Margin.page]` on the x
 * axis and `[Margin.page + headerOffset, page-height - Margin.page -
 * footerOffset]` on the y axis (the offsets reserve room for the
 * running header from page 2 and the per-page footer).
 *
 * `Gap` tokens are inter-block spacing. Use the smallest token that
 * still reads as a break between two distinct elements; the rhythm
 * relies on consistent reuse, not on per-section custom values.
 */
interface MarginTokens {
  readonly page: number;
  readonly headerOffset: number;
  readonly footerOffset: number;
}

interface GapTokens {
  readonly afterTitle: number;
  readonly afterHeader: number;
  readonly afterSection: number;
  readonly afterSubsection: number;
  readonly afterEntry: number;
}

export const Margin: MarginTokens = {
  page: 20,
  headerOffset: 8,
  footerOffset: 10,
};

export const Gap: GapTokens = {
  afterTitle: 9,
  afterHeader: 10,
  afterSection: 5,
  afterSubsection: 4,
  afterEntry: 2,
};

export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
export const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - 2 * Margin.page;
