import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupAuthenticatedSession } from './helpers';

const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/example-profile-v1.3.1.md',
);

// Short synthetic fixture for the happy-path test. Kept inline to keep the
// test fast and independent of the large v1.3.1 fixture; the full fixture
// is exercised in the integration unit test.
const SHORT_FIXTURE = [
  '# Medizinisches Profil - Version 1.0',
  '',
  '## 1. Basisdaten',
  '- **Alter:** 40',
  '',
  '## 2. Relevante Vorgeschichte',
  '### 2.1 Knie',
  '- **Beobachtung:** Schmerz bei Belastung.',
  '- **Muster:** Nach Lauftraining.',
  '- **Selbstregulation:** Laufen pausiert.',
  '- **Status:** Stabil',
].join('\n');

test.describe('Import flow', () => {
  test('happy path: paste short fixture, select profile, preview, confirm, done', async ({
    page,
  }) => {
    await setupAuthenticatedSession(page);

    // Navigate to /import via NavBar
    await page.getByRole('link', { name: 'Import' }).click();
    await expect(page.getByRole('heading', { name: 'Import aus Markdown' })).toBeVisible();

    // Paste fixture into textarea
    await page.getByLabel(/markdown-text einfuegen/i).fill(SHORT_FIXTURE);
    await page.getByRole('button', { name: 'Weiter' }).click();

    // Profile selection
    await expect(
      page.getByRole('heading', { name: /In welches Profil importieren/i }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Diesem Profil zuordnen' }).click();

    // Preview
    await expect(page.getByRole('heading', { name: 'Vorschau' })).toBeVisible();
    await page.getByRole('button', { name: 'Import starten' }).click();

    // Done
    await expect(page.getByRole('heading', { name: /Import erfolgreich/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('cancel from profile-selection returns to entry', async ({ page }) => {
    await setupAuthenticatedSession(page);
    await page.getByRole('link', { name: 'Import' }).click();
    await page.getByLabel(/markdown-text einfuegen/i).fill(SHORT_FIXTURE);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(
      page.getByRole('heading', { name: /In welches Profil importieren/i }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page.getByRole('heading', { name: 'Import aus Markdown' })).toBeVisible();
  });

  test('full real fixture imports successfully end-to-end', async ({ page }) => {
    const fullFixture = readFileSync(FIXTURE_PATH, 'utf-8');
    await setupAuthenticatedSession(page);
    await page.getByRole('link', { name: 'Import' }).click();
    await page.getByLabel(/markdown-text einfuegen/i).fill(fullFixture);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Diesem Profil zuordnen' }).click();
    await expect(page.getByRole('heading', { name: 'Vorschau' })).toBeVisible();
    await page.getByRole('button', { name: 'Import starten' }).click();
    await expect(page.getByRole('heading', { name: /Import erfolgreich/i })).toBeVisible({
      timeout: 15000,
    });
    // Summary shows observation count from the real fixture. Only sections
    // with a recognized Beobachtung / Muster / Selbstregulation triad become
    // Observations; narrative-bullet or table-only sections under
    // Belastungsreaktionen and Gewichtsmanagement surface as warning-level
    // notices instead of ghost entities (IM-06).
    await expect(page.getByText(/12 Beobachtungen/)).toBeVisible();

    // Navigating home lands on /profile showing the imported profile's name.
    await page.getByRole('button', { name: 'Zur Uebersicht' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Test-Profil' })).toBeVisible();
  });
});
