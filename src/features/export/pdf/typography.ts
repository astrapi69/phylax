/**
 * Typography tokens for the PDF export (X-09). Single source of truth
 * for font sizes and line heights so section renderers do not embed
 * magic numbers. All sizes are jsPDF point units; line heights are mm
 * (jsPDF doc is configured with `unit: 'mm'`).
 *
 * Naming follows the in-app web-typography conventions where they
 * align (`body`, `small`, `header`, `footer`); print-only concepts
 * (`cover`, `title`, `h2`) keep print-style names.
 */
export const FONT_FAMILY = 'helvetica';

interface FontSizeTokens {
  readonly cover: number;
  readonly coverSubtitle: number;
  readonly title: number;
  readonly h2: number;
  readonly h3: number;
  readonly body: number;
  readonly small: number;
  readonly footer: number;
  readonly header: number;
}

interface LeadingTokens {
  readonly body: number;
  readonly h2: number;
  readonly h3: number;
  readonly small: number;
}

export const FontSize: FontSizeTokens = {
  cover: 26,
  coverSubtitle: 12,
  title: 18,
  h2: 13,
  h3: 11,
  body: 10,
  small: 9,
  footer: 8,
  header: 9,
};

/**
 * Vertical advance per line in mm. jsPDF does not auto-advance after
 * `doc.text()`; callers add these to the y cursor after each rendered
 * line. Values track the body 10pt / h2 13pt mid-line gaps.
 */
export const Leading: LeadingTokens = {
  body: 5,
  h2: 7,
  h3: 6,
  small: 4.5,
};
