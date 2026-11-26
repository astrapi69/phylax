import { test, expect, type Page } from '@playwright/test';
import { setupAuthenticatedSession } from './helpers';

/**
 * M-09: with more than one profile the header names the active profile
 * on every authenticated route.
 *
 * Navigation goes through the UI only: a `page.goto` would reload the
 * app and lock it.
 */

const FIRST = 'Anna Beispiel';
const SECOND = 'Bernd Zweitprofil';
// 45 characters: longer than any header can show at 360px.
const LONG = 'Maximiliane Konstantinopoulou-Schwarzenberger';

const MOBILE_WIDTH = 360;
const MOBILE_HEIGHT = 740;

function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) < 768;
}

/** Follow a main navigation entry: side bar on desktop, drawer on mobile. */
async function navigateTo(page: Page, linkName: string, urlPattern: RegExp): Promise<void> {
  if (isMobile(page)) {
    await page.getByTestId('header-hamburger').click();
    await page.getByTestId('nav-drawer').getByRole('link', { name: linkName }).click();
  } else {
    await page.getByRole('link', { name: linkName, exact: true }).click();
  }
  await expect(page).toHaveURL(urlPattern);
}

/** Create a further profile through "Alle Profile". It becomes the active one. */
async function createFurtherProfile(page: Page, name: string): Promise<void> {
  await navigateTo(page, 'Alle Profile', /\/profiles$/);
  await page.getByRole('button', { name: '+ Neues Profil erstellen' }).click();
  await expect(page).toHaveURL(/\/profile\/create/);
  await page.getByLabel('Profilname').fill(name);
  await page.getByRole('button', { name: 'Profil erstellen' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible({ timeout: 10000 });
}

test.describe('Active profile in the header (M-09)', () => {
  test('one profile: the header shows no profile name', async ({ page }) => {
    await setupAuthenticatedSession(page, { profileName: FIRST });
    await navigateTo(page, 'Beobachtungen', /\/observations/);
    await expect(page.getByRole('heading', { level: 1, name: 'Beobachtungen' })).toBeVisible();
    await expect(page.getByTestId('header-active-profile')).toHaveCount(0);
  });

  test('two profiles: the name shows in a data view and follows a switch', async ({ page }) => {
    await setupAuthenticatedSession(page, { profileName: FIRST });
    await createFurtherProfile(page, SECOND);

    const headerLink = page.getByTestId('header-active-profile');
    await expect(headerLink).toHaveText(SECOND);
    await expect(headerLink).toHaveAccessibleName(`Aktives Profil: ${SECOND}`);

    await navigateTo(page, 'Beobachtungen', /\/observations/);
    await expect(page.getByRole('heading', { level: 1, name: 'Beobachtungen' })).toBeVisible();
    await expect(headerLink).toHaveText(SECOND);

    // The header link leads to the profile list; switch there.
    await headerLink.click();
    await expect(page).toHaveURL(/\/profiles$/);
    await page
      .getByTestId('profile-card')
      .filter({ hasText: FIRST })
      .getByRole('button', { name: 'Aktivieren' })
      .click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(headerLink).toHaveText(FIRST);

    await navigateTo(page, 'Beobachtungen', /\/observations/);
    await expect(headerLink).toHaveText(FIRST);
    await navigateTo(page, 'Laborwerte', /\/lab-values/);
    await expect(headerLink).toHaveText(FIRST);
    await expect(headerLink).toHaveAccessibleName(`Aktives Profil: ${FIRST}`);
  });

  test('360px: a long name truncates, the header keeps its controls', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'layout measurement is chromium-only');
    await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });
    await setupAuthenticatedSession(page, { profileName: FIRST });

    // The observations route has the search control too, so the header
    // is at its fullest there.
    await navigateTo(page, 'Beobachtungen', /\/observations/);
    await expect(page.getByRole('heading', { level: 1, name: 'Beobachtungen' })).toBeVisible();
    const before = await headerControlBoxes(page);

    await createFurtherProfile(page, LONG);
    await navigateTo(page, 'Beobachtungen', /\/observations/);
    await expect(page.getByRole('heading', { level: 1, name: 'Beobachtungen' })).toBeVisible();
    const nameSpan = page.getByTestId('header-active-profile-name');
    await expect(nameSpan).toHaveText(LONG);
    const after = await headerControlBoxes(page);

    // No control was pushed out, moved off screen or shrunk.
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    for (const [key, box] of Object.entries(before)) {
      const now = after[key];
      expect(now, `control ${key} still present`).toBeDefined();
      if (!now) continue;
      expect(now.width, `${key} width`).toBeCloseTo(box.width, 0);
      expect(now.height, `${key} height`).toBeCloseTo(box.height, 0);
      expect(now.right, `${key} inside the viewport`).toBeLessThanOrEqual(MOBILE_WIDTH);
      expect(now.left, `${key} inside the viewport`).toBeGreaterThanOrEqual(0);
    }

    // The header neither wraps nor overflows.
    const header = await page
      .locator('header')
      .first()
      .evaluate((el) => ({
        height: el.getBoundingClientRect().height,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
    expect(header.height).toBe(56);
    expect(header.scrollWidth).toBeLessThanOrEqual(header.clientWidth);
    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(pageOverflow).toBeLessThanOrEqual(0);

    // The profile link stays inside the header and on one line.
    const link = await page.getByTestId('header-active-profile').evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, right: rect.right, height: rect.height };
    });
    expect(link.top).toBeGreaterThanOrEqual(0);
    expect(link.bottom).toBeLessThanOrEqual(56);
    expect(link.right).toBeLessThanOrEqual(MOBILE_WIDTH);
    expect(link.height).toBeGreaterThanOrEqual(24);

    // How much of the name is visible. The span is truncated with an
    // ellipsis, so the share of its width that fits tells the count.
    const name = await nameSpan.evaluate((el) => ({
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
    }));
    expect(name.scrollWidth, 'the long name is truncated').toBeGreaterThan(name.clientWidth);
    const visibleCharacters = Math.floor((LONG.length * name.clientWidth) / name.scrollWidth);
    testInfo.annotations.push({
      type: 'M-09 visible characters at 360px',
      description: `${visibleCharacters} of ${LONG.length} (span ${name.clientWidth}px of ${name.scrollWidth}px)`,
    });
    // console.warn, not log: the number has to reach the CI log, and the
    // lint rule allows warn and error only.
    console.warn(
      `M-09 visible characters at 360px: ${visibleCharacters} of ${LONG.length} (span ${name.clientWidth}px of ${name.scrollWidth}px)`,
    );
    expect(visibleCharacters).toBeGreaterThanOrEqual(8);
  });
});

interface Box {
  left: number;
  right: number;
  width: number;
  height: number;
}

/**
 * Boxes of every existing header control, keyed by its accessible
 * label or text. The M-09 profile link is left out: it is the new one.
 */
async function headerControlBoxes(page: Page): Promise<Record<string, Box>> {
  return page
    .locator('header')
    .first()
    .evaluate((header) => {
      const result: Record<string, { left: number; right: number; width: number; height: number }> =
        {};
      for (const el of Array.from(header.querySelectorAll('a, button'))) {
        if (el.getAttribute('data-testid') === 'header-active-profile') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        const key =
          el.getAttribute('data-testid') ??
          el.getAttribute('aria-label') ??
          (el.textContent ?? '').trim();
        result[key] = {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        };
      }
      return result;
    });
}
