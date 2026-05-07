import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession } from './helpers';

// BUG-11 regression: switching the UI language at runtime from
// Settings must repaint the visible screen in the new language.
// Before the fix, clicking "English" left every i18n-translated
// string on the page rendering as raw dotted keys until reload,
// because the lazy EN namespace bundle had not finished loading
// when i18next emitted languageChanged.
test.describe('Language switch (BUG-11)', () => {
  test('switches UI from German to English without raw keys', async ({ page }) => {
    await setupAuthenticatedSession(page);

    await page.getByRole('link', { name: 'Einstellungen' }).click();
    await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible();

    await page.getByRole('radio', { name: 'English' }).check();

    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Language', level: 2 })).toBeVisible();

    // No bare i18n keys leaked into the DOM. A raw key looks like
    // "settings.heading" or "language.heading"; check the visible
    // text of the headings and section labels does not match that
    // dotted-path shape.
    const visibleText = await page.locator('main, [role="main"], body').first().innerText();
    expect(visibleText).not.toMatch(/\b[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]+){1,}\b/);
  });
});
