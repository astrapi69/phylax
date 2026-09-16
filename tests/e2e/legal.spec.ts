import { test, expect } from '@playwright/test';

/**
 * P-16: /impressum and /datenschutz must work on a direct call and
 * survive a hard reload, not fall through to the onboarding/unlock
 * route, since Section 5 DDG requires the legal notice to be
 * immediately accessible without an account. No seeded session here
 * on purpose: these routes sit outside SetupFlowGuard/ProtectedRoute.
 */
test.describe('Legal pages', () => {
  test('impressum is reachable via a direct URL with no vault set up', async ({ page }) => {
    await page.goto('/impressum');
    await expect(page.getByRole('heading', { level: 1, name: 'Impressum' })).toBeVisible();
  });

  test('datenschutz is reachable via a direct URL and survives a hard reload', async ({ page }) => {
    await page.goto('/datenschutz');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' }),
    ).toBeVisible();

    await page.reload();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' }),
    ).toBeVisible();
  });

  test('the legal footer links to both pages from the first-run welcome screen', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Impressum' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Impressum' })).toBeVisible();

    await page.goto('/');
    await page.getByRole('link', { name: 'Datenschutz' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' }),
    ).toBeVisible();
  });
});
