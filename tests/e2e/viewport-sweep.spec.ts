import { test, expect, type Page } from '@playwright/test';
import { setupAuthenticatedSession } from './helpers';

/**
 * P-01 Tier 1: automated viewport sweep at 360 / 768 / 1024 px.
 *
 * Covers structural overflow (no horizontal scrollbar) and invisible
 * interactive elements (every visible button/link/input has a non-zero
 * bounding box). Pure shell-layout assertions; content-heavy overflow
 * is left to the manual Tier 2 eye-check documented in the audit.
 *
 * Chromium-only by design (Q4 lock): mobile responsive bugs are CSS,
 * engine-independent. F-06b's Firefox + WebKit projects exist for
 * engine-specific differences and would 3x the runtime without
 * surfacing different bugs.
 */

const VIEWPORT_HEIGHT = 800;
const VIEWPORTS = [360, 768, 1024] as const;
type Viewport = (typeof VIEWPORTS)[number];

/**
 * Routes reached without an unlocked vault. EntryRouter at "/" routes
 * fresh installs to /welcome, so these sit on the no-vault branch.
 */
const PUBLIC_ROUTES = ['/welcome', '/privacy', '/setup', '/backup/import/select'] as const;

/**
 * Routes behind ProtectedRoute. Reached after `setupAuthenticatedSession`.
 * Empty profile = empty list state for entity views; that is a legitimate
 * shell-layout target and what users see on a fresh setup. Content-heavy
 * scenarios (50+ lab values, very long observation prose) are left to the
 * manual Tier 2 sweep.
 */
const PROTECTED_ROUTES = [
  '/profile',
  '/observations',
  '/lab-values',
  '/supplements',
  '/open-points',
  '/timeline',
  '/import',
  '/settings',
  '/license',
] as const;

async function assertNoHorizontalOverflow(page: Page, width: Viewport, route: string) {
  // 1px tolerance: rounding + scrollbar gutter on some platforms.
  const scrollWidth = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth;
  });
  expect(scrollWidth, `${route} @ ${width}px horizontal overflow (scrollWidth=${scrollWidth})`).toBeLessThanOrEqual(width + 1);
}

async function assertVisibleInteractivesHaveBox(page: Page, width: Viewport, route: string) {
  // Catch BUG-02-class regressions: items rendered into the DOM but
  // squeezed to zero width by an over-tight flex container. Skip
  // elements that are not in the visible layout flow (display:none,
  // hidden parents, sr-only). Only assert on those a user can see.
  const offenders = await page.evaluate(() => {
    const selector = 'a, button, [role="button"], input:not([type="hidden"]), select, textarea';
    const result: { tag: string; text: string; rect: { w: number; h: number } }[] = [];
    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const rect = el.getBoundingClientRect();
      // sr-only utility renders a 1x1 absolutely positioned element;
      // skip those (they are intentionally invisible to sighted users).
      if (rect.width <= 1 && rect.height <= 1) return;
      // Anything else with zero in either dimension is a bug.
      if (rect.width === 0 || rect.height === 0) {
        result.push({
          tag: el.tagName,
          text: (el.textContent ?? '').trim().slice(0, 40),
          rect: { w: rect.width, h: rect.height },
        });
      }
    });
    return result;
  });
  expect(
    offenders,
    `${route} @ ${width}px has zero-box interactives: ${JSON.stringify(offenders)}`,
  ).toHaveLength(0);
}

async function sweepRoute(page: Page, width: Viewport, route: string) {
  await page.goto(route);
  // Give the route's first paint a tick so layout is settled before
  // measuring. networkidle is too strict for SPA routes that don't
  // necessarily fire requests on navigation; load is enough.
  await page.waitForLoadState('load');
  await assertNoHorizontalOverflow(page, width, route);
  await assertVisibleInteractivesHaveBox(page, width, route);
}

for (const width of VIEWPORTS) {
  test.describe(`P-01 viewport sweep @ ${width}px`, () => {
    test.beforeEach(async ({ page }, testInfo) => {
      // Q4 lock: chromium-only.
      test.skip(testInfo.project.name !== 'chromium', 'viewport sweep is chromium-only');
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    });

    test(`public routes`, async ({ page }) => {
      for (const route of PUBLIC_ROUTES) {
        await test.step(route, async () => {
          await sweepRoute(page, width, route);
        });
      }
    });

    test(`protected routes`, async ({ page }) => {
      await setupAuthenticatedSession(page);
      for (const route of PROTECTED_ROUTES) {
        await test.step(route, async () => {
          await sweepRoute(page, width, route);
        });
      }
    });
  });
}
