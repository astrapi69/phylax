import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { A11Y_EXCLUSIONS } from './a11y-exclusions';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type SystemPreference = 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/**
 * The light/dark matrix we run per screen. `light` and `dark` themes are
 * independent of the system preference, so we only vary the system
 * preference when the theme is `auto`.
 */
export const THEME_MATRIX: Array<{ theme: ThemeMode; sysPref: SystemPreference }> = [
  { theme: 'light', sysPref: 'light' },
  { theme: 'dark', sysPref: 'light' },
  { theme: 'auto', sysPref: 'light' },
  { theme: 'auto', sysPref: 'dark' },
];

/**
 * Prepare a page to render in the specified theme BEFORE navigation.
 * Sets the system color-scheme emulation and seeds localStorage so the
 * flash-prevention inline script applies the correct class on first paint.
 *
 * Must be called before `page.goto`. Calling it after a navigation has
 * already happened leaves the first paint unthemed.
 */
export async function prepareTheme(
  page: Page,
  theme: ThemeMode,
  systemPreference: SystemPreference = 'light',
): Promise<void> {
  await page.emulateMedia({ colorScheme: systemPreference });
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem('phylax-theme', t);
    } catch {
      // localStorage may be disabled in some test contexts; the inline
      // script falls back to light in that case.
    }
  }, theme);
}

/**
 * The theme class that should actually be applied to `<html>` for a given
 * explicit choice + system preference.
 */
export function resolvedTheme(theme: ThemeMode, systemPreference: SystemPreference): ResolvedTheme {
  if (theme === 'auto') return systemPreference;
  return theme;
}

/**
 * Assert the `<html>` element has or lacks the `dark` class matching the
 * expected theme.
 */
export async function assertTheme(page: Page, expected: ResolvedTheme): Promise<void> {
  const hasDark = await page.locator('html').evaluate((el) => el.classList.contains('dark'));
  if (expected === 'dark') {
    expect(hasDark, 'expected <html> to have the dark class').toBe(true);
  } else {
    expect(hasDark, 'expected <html> to NOT have the dark class').toBe(false);
  }
}

/**
 * Assert the background color of a selector is not the default black/white
 * and respects the expected theme. Heuristic check via the average RGB
 * channel value.
 */
export async function assertBackgroundRespectsTheme(
  page: Page,
  expected: ResolvedTheme,
): Promise<void> {
  // Walk the DOM from body downward, return the first element that has a
  // non-transparent backgroundColor. Some screens (onboarding, unlock) set
  // their background on an inner full-height div rather than on body, so
  // checking body alone would see rgba(0,0,0,0).
  const bg = await page.evaluate(() => {
    function computedBg(el: Element): string {
      return window.getComputedStyle(el).backgroundColor;
    }
    function isOpaque(c: string): boolean {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c);
      if (!m) return false;
      const alpha = m[4] === undefined ? 1 : Number(m[4]);
      return alpha > 0;
    }
    function find(el: Element): string | null {
      const c = computedBg(el);
      if (isOpaque(c)) return c;
      for (const child of Array.from(el.children)) {
        const hit = find(child);
        if (hit) return hit;
      }
      return null;
    }
    return find(document.body);
  });

  if (!bg) {
    throw new Error('No element with an opaque background found on the page.');
  }
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(bg);
  if (!match) return;
  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  const avg = (r + g + b) / 3;
  if (expected === 'dark') {
    expect(avg, `expected dark background, got rgb(${r}, ${g}, ${b})`).toBeLessThan(100);
  } else {
    expect(avg, `expected light background, got rgb(${r}, ${g}, ${b})`).toBeGreaterThan(200);
  }
}

/**
 * Run axe accessibility checks on the current page against WCAG 2 A and AA.
 * Throws with a readable summary if any violation remains after applying the
 * project's exclusion list.
 */
export async function assertNoA11yViolations(
  page: Page,
  options: { screen?: string } = {},
): Promise<void> {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']);

  // Scope-level exclusions via selectors (node-level). Rule-level exclusions
  // are applied after the scan using the raw result so we can keep the full
  // structured justification in a11y-exclusions.ts.
  const selectorExclusions = A11Y_EXCLUSIONS.map((e) => e.selector).filter(
    (s): s is string => typeof s === 'string' && s.length > 0,
  );
  for (const sel of selectorExclusions) builder.exclude(sel);

  const results = await builder.analyze();

  const suppressedRules = new Set(
    A11Y_EXCLUSIONS.filter((e) => !e.screen || e.screen === options.screen).map((e) => e.rule),
  );
  const violations = results.violations.filter((v) => !suppressedRules.has(v.id));

  if (violations.length > 0) {
    const summary = violations
      .map((v) => {
        const header = `  - ${v.id}: ${v.description} (${v.nodes.length} node${v.nodes.length === 1 ? '' : 's'})`;
        const nodes = v.nodes
          .slice(0, 5)
          .map((n) => {
            const target = n.target.join(' ');
            const fail = n.failureSummary?.replace(/\n/g, ' | ') ?? '';
            const html = n.html ? n.html.substring(0, 200) : '';
            return `      target: ${target}\n      html: ${html}\n      why: ${fail}`;
          })
          .join('\n');
        return `${header}\n${nodes}`;
      })
      .join('\n');
    throw new Error(`Axe violations on ${options.screen ?? 'page'}:\n${summary}`);
  }
}
