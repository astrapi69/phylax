import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THEME_MATRIX,
  assertBackgroundRespectsTheme,
  assertNoA11yViolations,
  assertTheme,
  prepareTheme,
  resolvedTheme,
  type ThemeMode,
  type SystemPreference,
} from './smoke-helpers';

/**
 * Smoke tests run against the production build (see playwright.config.production.ts).
 *
 * Goal: every user-facing screen renders without crashing and passes WCAG 2 A+AA
 * in light, dark, and auto modes. Not a replacement for functional E2E tests in
 * tests/e2e/; those exercise user flows, these exercise rendering + accessibility
 * per theme variant.
 *
 * To run: `make test-e2e-production` (also chained in `make ci-local-full`).
 */

const DEFAULT_PASSWORD = 'test-password-12';
const DEFAULT_PROFILE_NAME = 'Test-Profil';
const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/example-profile-v1.3.1.md',
);

async function clearDatabase(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('phylax');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
  await page.reload();
}

async function completeOnboarding(page: Page) {
  await page.getByLabel('Master-Passwort').first().fill(DEFAULT_PASSWORD);
  await page.getByLabel('Passwort wiederholen').fill(DEFAULT_PASSWORD);
  await page.getByLabel('Ich habe verstanden').check();
  await page.getByRole('button', { name: 'Phylax einrichten' }).click();
  await expect(page.getByRole('heading', { name: 'Neues Profil erstellen' })).toBeVisible({
    timeout: 10000,
  });
}

async function createDefaultProfile(page: Page) {
  await page.getByLabel('Profilname').fill(DEFAULT_PROFILE_NAME);
  await page.getByRole('button', { name: 'Profil erstellen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: DEFAULT_PROFILE_NAME })).toBeVisible({
    timeout: 10000,
  });
}

async function setupOnboardedState(page: Page, theme: ThemeMode, sysPref: SystemPreference) {
  await prepareTheme(page, theme, sysPref);
  await clearDatabase(page);
  await page.goto('/onboarding');
  await completeOnboarding(page);
}

async function setupAuthenticatedState(page: Page, theme: ThemeMode, sysPref: SystemPreference) {
  await setupOnboardedState(page, theme, sysPref);
  await createDefaultProfile(page);
}

async function importFixture(page: Page) {
  const content = readFileSync(FIXTURE_PATH, 'utf-8');
  await page.getByRole('link', { name: 'Import' }).click();
  await page.getByLabel(/markdown-text einfügen/i).fill(content);
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Diesem Profil zuordnen' }).click();
  await expect(page.getByRole('heading', { name: 'Vorschau' })).toBeVisible();
  await page.getByRole('button', { name: 'Import starten' }).click();
  await expect(page.getByRole('heading', { name: /Import erfolgreich/i })).toBeVisible({
    timeout: 15000,
  });
}

/**
 * Run the four-variant theme matrix for a screen. The screen callback
 * handles its own navigation because each screen's path through the
 * app differs; this helper only runs the standard assertions after
 * the callback returns.
 */
function matrixTests(
  describeName: string,
  screen: string,
  navigate: (page: Page, variant: { theme: ThemeMode; sysPref: SystemPreference }) => Promise<void>,
) {
  test.describe(describeName, () => {
    for (const { theme, sysPref } of THEME_MATRIX) {
      test(`${screen} in theme=${theme} sysPref=${sysPref}`, async ({ page }) => {
        await navigate(page, { theme, sysPref });
        const expected = resolvedTheme(theme, sysPref);
        await assertTheme(page, expected);
        await assertBackgroundRespectsTheme(page, expected);
        await assertNoA11yViolations(page, { screen });
      });
    }
  });
}

// -- Onboarding -----------------------------------------------------------

matrixTests('Smoke: onboarding', 'onboarding', async (page, { theme, sysPref }) => {
  await prepareTheme(page, theme, sysPref);
  await clearDatabase(page);
  await page.goto('/onboarding');
  await expect(page.getByRole('heading', { name: 'Phylax einrichten' })).toBeVisible();
});

// -- Unlock ---------------------------------------------------------------

matrixTests('Smoke: unlock', 'unlock', async (page, { theme, sysPref }) => {
  await setupAuthenticatedState(page, theme, sysPref);
  await page.reload(); // clears in-memory key, returns to /unlock
  await expect(page.getByRole('heading', { name: 'Phylax entsperren' })).toBeVisible();
});

matrixTests('Smoke: unlock with error', 'unlock-error', async (page, { theme, sysPref }) => {
  await setupAuthenticatedState(page, theme, sysPref);
  await page.reload();
  await page.getByLabel('Master-Passwort').fill('wrong-password1');
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByText('Falsches Passwort.')).toBeVisible({ timeout: 10000 });
});

// -- Profile create -------------------------------------------------------

matrixTests('Smoke: profile create', 'profile-create', async (page, { theme, sysPref }) => {
  await setupOnboardedState(page, theme, sysPref);
  await expect(page.getByRole('heading', { name: 'Neues Profil erstellen' })).toBeVisible();
});

// -- Profile view (populated) ---------------------------------------------

matrixTests('Smoke: profile view populated', 'profile-view', async (page, { theme, sysPref }) => {
  await setupAuthenticatedState(page, theme, sysPref);
  await importFixture(page);
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
  await expect(page.getByRole('heading', { level: 1, name: DEFAULT_PROFILE_NAME })).toBeVisible();
});

// -- Import flow screens --------------------------------------------------

matrixTests('Smoke: import entry', 'import-entry', async (page, { theme, sysPref }) => {
  await setupAuthenticatedState(page, theme, sysPref);
  await page.getByRole('link', { name: 'Import' }).click();
  await expect(page.getByRole('heading', { name: 'Import aus Markdown' })).toBeVisible();
});

matrixTests(
  'Smoke: import profile selection',
  'import-profile-selection',
  async (page, { theme, sysPref }) => {
    await setupAuthenticatedState(page, theme, sysPref);
    const content = readFileSync(FIXTURE_PATH, 'utf-8');
    await page.getByRole('link', { name: 'Import' }).click();
    await page.getByLabel(/markdown-text einfügen/i).fill(content);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(
      page.getByRole('heading', { name: /In welches Profil importieren/i }),
    ).toBeVisible();
  },
);

matrixTests('Smoke: import preview', 'import-preview', async (page, { theme, sysPref }) => {
  await setupAuthenticatedState(page, theme, sysPref);
  const content = readFileSync(FIXTURE_PATH, 'utf-8');
  await page.getByRole('link', { name: 'Import' }).click();
  await page.getByLabel(/markdown-text einfügen/i).fill(content);
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('button', { name: 'Diesem Profil zuordnen' }).click();
  await expect(page.getByRole('heading', { name: 'Vorschau' })).toBeVisible();
});

matrixTests(
  'Smoke: import confirm-replace dialog',
  'import-confirm',
  async (page, { theme, sysPref }) => {
    // Populate the target first, then start a second import to open the
    // replace-confirmation modal.
    await setupAuthenticatedState(page, theme, sysPref);
    await importFixture(page);
    await page.getByRole('button', { name: 'Weiteren Import' }).click();
    const content = readFileSync(FIXTURE_PATH, 'utf-8');
    await page.getByLabel(/markdown-text einfügen/i).fill(content);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Diesem Profil zuordnen' }).click();
    await expect(page.getByRole('heading', { name: /Bestehende Daten ersetzen/i })).toBeVisible();
  },
);

matrixTests(
  'Smoke: import result success',
  'import-result-success',
  async (page, { theme, sysPref }) => {
    await setupAuthenticatedState(page, theme, sysPref);
    await importFixture(page);
    await expect(page.getByRole('heading', { name: /Import erfolgreich/i })).toBeVisible();
  },
);

// Result-failure screen is exercised by ResultScreen.test.tsx at the unit level.
// Triggering a real failure end-to-end would require breaking the transaction
// in a way that is hard to reach without patching production code, so the
// smoke suite deliberately only covers the success variant of ResultScreen.

// -- Settings -------------------------------------------------------------

matrixTests('Smoke: settings', 'settings', async (page, { theme, sysPref }) => {
  await setupAuthenticatedState(page, theme, sysPref);
  await page.getByRole('link', { name: 'Einstellungen' }).click();
  await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
});

// -- Placeholders ---------------------------------------------------------

matrixTests('Smoke: observations empty', 'observations-empty', async (page, { theme, sysPref }) => {
  await setupAuthenticatedState(page, theme, sysPref);
  await page.getByRole('link', { name: 'Beobachtungen' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Beobachtungen' })).toBeVisible();
  await expect(page.getByText(/Noch keine Beobachtungen/)).toBeVisible();
});

matrixTests(
  'Smoke: observations populated',
  'observations-populated',
  async (page, { theme, sysPref }) => {
    await setupAuthenticatedState(page, theme, sysPref);
    await importFixture(page);
    await page.getByRole('link', { name: 'Beobachtungen' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Beobachtungen' })).toBeVisible();
    // At least one theme group heading is present
    const themeHeadings = page.getByRole('heading', { level: 2 });
    await expect(themeHeadings.first()).toBeVisible();
  },
);

matrixTests('Smoke: lab values empty', 'lab-values-empty', async (page, { theme, sysPref }) => {
  await setupAuthenticatedState(page, theme, sysPref);
  await page.getByRole('link', { name: 'Laborwerte' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Laborwerte' })).toBeVisible();
  await expect(page.getByText(/Noch keine Laborwerte/)).toBeVisible();
});

matrixTests(
  'Smoke: lab values populated',
  'lab-values-populated',
  async (page, { theme, sysPref }) => {
    await setupAuthenticatedState(page, theme, sysPref);
    await importFixture(page);
    await page.getByRole('link', { name: 'Laborwerte' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Laborwerte' })).toBeVisible();
    // At least one report heading visible
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  },
);

matrixTests('Smoke: supplements empty', 'supplements-empty', async (page, { theme, sysPref }) => {
  await setupAuthenticatedState(page, theme, sysPref);
  await page.getByRole('link', { name: 'Supplemente' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Supplemente' })).toBeVisible();
  await expect(page.getByText(/Noch keine Supplemente/)).toBeVisible();
});

matrixTests(
  'Smoke: supplements populated',
  'supplements-populated',
  async (page, { theme, sysPref }) => {
    await setupAuthenticatedState(page, theme, sysPref);
    await importFixture(page);
    await page.getByRole('link', { name: 'Supplemente' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Supplemente' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  },
);

matrixTests('Smoke: open points empty', 'open-points-empty', async (page, { theme, sysPref }) => {
  await setupAuthenticatedState(page, theme, sysPref);
  await page.getByRole('link', { name: 'Offene Punkte' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Offene Punkte' })).toBeVisible();
  await expect(page.getByText(/Keine offenen Punkte/)).toBeVisible();
});

matrixTests(
  'Smoke: open points populated',
  'open-points-populated',
  async (page, { theme, sysPref }) => {
    await setupAuthenticatedState(page, theme, sysPref);
    await importFixture(page);
    await page.getByRole('link', { name: 'Offene Punkte' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Offene Punkte' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  },
);

matrixTests('Smoke: documents placeholder', 'documents', async (page, { theme, sysPref }) => {
  await setupAuthenticatedState(page, theme, sysPref);
  await page.getByRole('link', { name: 'Dokumente' }).click();
  await expect(page.getByRole('heading', { name: 'Dokumente' })).toBeVisible();
});
