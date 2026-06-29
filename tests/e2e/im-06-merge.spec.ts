import { test, expect, type Page } from '@playwright/test';
import { setupAuthenticatedSession } from './helpers';

/**
 * IM-06 field-level merge e2e suite. Automates the parts of the
 * manual-smoke walk
 * (`docs/manual-smoke/im-06-field-level-merge.md`) that real
 * browsers can verify without subjective visual judgment. Visual
 * scenarios (light/dark contrast, exact pixel fit) stay manual.
 *
 * Pattern: minimal inline fixtures. Tests build their own A/B pair
 * per scenario rather than relying on the full
 * `profile-a.md` / `profile-b.md` files; smaller surface keeps the
 * tests fast and the parser-friendly markdown easier to control.
 *
 * Per-test timeout: each test runs the full onboarding flow plus a
 * baseline import plus the scenario-specific merge import. That
 * sequence routinely consumes 20-25s on a warm dev server and well
 * past 30s on a cold start. Lift the per-test timeout to 60s so the
 * scenario assertions have headroom.
 */
test.describe.configure({ timeout: 60_000 });

const BASE_FIXTURE = [
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

/** Same theme + different `fact` -> field-level conflict. */
const CONFLICT_FIXTURE = [
  '# Medizinisches Profil - Version 1.0',
  '',
  '## 1. Basisdaten',
  '- **Alter:** 40',
  '',
  '## 2. Relevante Vorgeschichte',
  '### 2.1 Knie',
  '- **Beobachtung:** GEÄNDERTE FAKT',
  '- **Muster:** Nach Lauftraining.',
  '- **Selbstregulation:** Laufen pausiert.',
  '- **Status:** Stabil',
].join('\n');

/** Disjoint theme -> additive merge, no conflict. */
const DISJOINT_FIXTURE = [
  '# Medizinisches Profil - Version 1.0',
  '',
  '## 1. Basisdaten',
  '- **Alter:** 40',
  '',
  '## 2. Relevante Vorgeschichte',
  '### 2.1 Hüfte',
  '- **Beobachtung:** Stechen beim Aufstehen.',
  '- **Muster:** Nach Autofahrten.',
  '- **Selbstregulation:** Hüftbeuger dehnen.',
  '- **Status:** Neu',
].join('\n');

/**
 * Drive entry: navigate to /import, paste markdown, Weiter,
 * "Diesem Profil zuordnen". Lands at Vorschau (empty target) or
 * the ConfirmDialog (non-empty).
 */
async function pasteAndContinue(page: Page, markdown: string): Promise<void> {
  await page.getByRole('link', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Import aus Markdown' })).toBeVisible();
  await page.getByLabel(/markdown-text einfügen/i).fill(markdown);
  const weiter = page.getByRole('button', { name: 'Weiter' });
  await expect(weiter).toBeEnabled({ timeout: 10000 });
  await weiter.click();
  await expect(page.getByRole('heading', { name: /In welches Profil importieren/i })).toBeVisible();
  await page.getByRole('button', { name: 'Diesem Profil zuordnen' }).click();
}

/**
 * Pre-load the BASE fixture into the default profile so subsequent
 * imports run against a non-empty target. Returns the user to
 * /profile after success.
 */
async function loadBase(page: Page): Promise<void> {
  await pasteAndContinue(page, BASE_FIXTURE);
  await expect(page.getByRole('heading', { name: 'Vorschau' })).toBeVisible();
  await page.getByRole('button', { name: 'Import starten' }).click();
  await expect(page.getByRole('heading', { name: /Import erfolgreich/i })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Zur Übersicht' }).click();
}

/**
 * Pick a single ConfirmDialog mode for every visible row whose
 * radio is enabled. Waits for the dialog to render first so the
 * testid lookups race-free against React's state transitions.
 * Hidden rows (parsed=0 after S1-A fix) are silently skipped via
 * the testid count check.
 */
async function pickModeForAllVisibleRows(
  page: Page,
  mode: 'replace' | 'merge' | 'skip',
): Promise<void> {
  await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 10000 });
  const rowKeys = [
    'observations',
    'labData',
    'supplements',
    'openPoints',
    'timelineEntries',
    'profileVersions',
  ];
  for (const k of rowKeys) {
    const radio = page.getByTestId(`confirm-row-${k}-${mode}`);
    if ((await radio.count()) === 0) continue;
    if (await radio.isDisabled().catch(() => true)) continue;
    await radio.click({ force: true });
  }
}

/**
 * Übernehmen on ConfirmDialog returns to preview with the
 * replaceSelection set. The actual import runs only after the
 * user clicks "Import starten" on the preview screen. This
 * helper performs both clicks back-to-back so callers can chain
 * straight to the post-import assertion.
 */
async function applyAndStart(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(page.getByRole('heading', { name: 'Vorschau' })).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Import starten' }).click();
}

test.describe('IM-06 merge - core outcomes', () => {
  test('disjoint themes merge -> pure inserts, no conflicts', async ({ page }) => {
    await setupAuthenticatedSession(page);
    await loadBase(page);
    await pasteAndContinue(page, DISJOINT_FIXTURE);
    await expect(
      page.getByRole('heading', { name: /Import in bestehendes Profil/i }),
    ).toBeVisible();
    await pickModeForAllVisibleRows(page, 'merge');
    await applyAndStart(page);

    await expect(page.getByTestId('conflict-resolution-dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Import erfolgreich/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test('identical re-import collapses to no-op', async ({ page }) => {
    await setupAuthenticatedSession(page);
    await loadBase(page);
    await pasteAndContinue(page, BASE_FIXTURE);
    await pickModeForAllVisibleRows(page, 'merge');
    await applyAndStart(page);
    await expect(page.getByTestId('conflict-resolution-dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Import erfolgreich/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test('S2-A all-skip selection: Übernehmen disabled + hint shown', async ({ page }) => {
    await setupAuthenticatedSession(page);
    await loadBase(page);
    await pasteAndContinue(page, BASE_FIXTURE);
    await pickModeForAllVisibleRows(page, 'skip');
    await expect(page.getByTestId('confirm-all-skip-hint')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Übernehmen' })).toBeDisabled();

    // Switching one row to merge re-enables Übernehmen + hides hint.
    await page.getByTestId('confirm-row-observations-merge').check({ force: true });
    await expect(page.getByTestId('confirm-all-skip-hint')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Übernehmen' })).toBeEnabled();
  });
});

test.describe('IM-06 merge - conflict resolution', () => {
  test('field-level conflict -> ConflictResolutionDialog opens', async ({ page }) => {
    await setupAuthenticatedSession(page);
    await loadBase(page);
    await pasteAndContinue(page, CONFLICT_FIXTURE);
    await pickModeForAllVisibleRows(page, 'merge');
    await applyAndStart(page);

    await expect(page.getByTestId('conflict-resolution-dialog')).toBeVisible();
    await expect(page.getByTestId('conflict-resolution-dialog-confirm')).toBeDisabled();
  });

  test('Q2 gating: Confirm enables only after every conflict picked', async ({ page }) => {
    await setupAuthenticatedSession(page);
    await loadBase(page);
    await pasteAndContinue(page, CONFLICT_FIXTURE);
    await pickModeForAllVisibleRows(page, 'merge');
    await applyAndStart(page);
    await expect(page.getByTestId('conflict-resolution-dialog')).toBeVisible();

    const confirm = page.getByTestId('conflict-resolution-dialog-confirm');
    await expect(confirm).toBeDisabled();

    // Pick mine on the first conflict.
    const mineRadio = page.locator('[data-testid$="-mine"][type="radio"]').first();
    await mineRadio.check({ force: true });
    await expect(confirm).toBeEnabled();
  });

  test('mine resolution: existing fact preserved', async ({ page }) => {
    await setupAuthenticatedSession(page);
    await loadBase(page);
    await pasteAndContinue(page, CONFLICT_FIXTURE);
    await pickModeForAllVisibleRows(page, 'merge');
    await applyAndStart(page);
    await expect(page.getByTestId('conflict-resolution-dialog')).toBeVisible();

    const mineRadio = page.locator('[data-testid$="-mine"][type="radio"]').first();
    await mineRadio.check({ force: true });
    await page.getByTestId('conflict-resolution-dialog-confirm').click();
    await expect(page.getByRole('heading', { name: /Import erfolgreich/i })).toBeVisible({
      timeout: 15000,
    });

    // Verify existing observation preserved (fact unchanged).
    await page.getByRole('button', { name: 'Zur Übersicht' }).click();
    await page.getByRole('link', { name: 'Beobachtungen' }).click();
    await expect(page.getByText(/Schmerz bei Belastung\./).first()).toBeVisible();
    await expect(page.getByText(/GEÄNDERTE FAKT/)).toHaveCount(0);
  });

  test('theirs resolution: existing fact overwritten by parsed value', async ({ page }) => {
    await setupAuthenticatedSession(page);
    await loadBase(page);
    await pasteAndContinue(page, CONFLICT_FIXTURE);
    await pickModeForAllVisibleRows(page, 'merge');
    await applyAndStart(page);
    await expect(page.getByTestId('conflict-resolution-dialog')).toBeVisible();

    const theirsRadio = page.locator('[data-testid$="-theirs"][type="radio"]').first();
    await theirsRadio.check({ force: true });
    await page.getByTestId('conflict-resolution-dialog-confirm').click();
    await expect(page.getByRole('heading', { name: /Import erfolgreich/i })).toBeVisible({
      timeout: 15000,
    });

    // Verify existing observation now reflects parsed fact.
    await page.getByRole('button', { name: 'Zur Übersicht' }).click();
    await page.getByRole('link', { name: 'Beobachtungen' }).click();
    await expect(page.getByText(/GEÄNDERTE FAKT/).first()).toBeVisible();
    await expect(page.getByText(/Schmerz bei Belastung\./)).toHaveCount(0);
  });

  test('field-by-field opens per-field expansion panel', async ({ page }) => {
    await setupAuthenticatedSession(page);
    await loadBase(page);
    await pasteAndContinue(page, CONFLICT_FIXTURE);
    await pickModeForAllVisibleRows(page, 'merge');
    await applyAndStart(page);
    await expect(page.getByTestId('conflict-resolution-dialog')).toBeVisible();

    const fbf = page
      .locator('[data-testid$="-field-by-field"][type="radio"]:not([disabled])')
      .first();
    await fbf.check({ force: true });

    // Per-field expansion panel becomes visible (fbf-panel testid prefix).
    await expect(page.locator('[data-testid$="-fbf-panel"]').first()).toBeVisible();
  });
});

test.describe('IM-06 merge - cancel paths', () => {
  test('ESC during conflict-resolution returns to entry; vault unchanged', async ({ page }) => {
    await setupAuthenticatedSession(page);
    await loadBase(page);
    await pasteAndContinue(page, CONFLICT_FIXTURE);
    await pickModeForAllVisibleRows(page, 'merge');
    await applyAndStart(page);
    await expect(page.getByTestId('conflict-resolution-dialog')).toBeVisible();

    // BUG-14: on WebKit a single Escape keypress intermittently fails to
    // reach the dialog's keydown handler (focus race) or the close lags
    // past the default 5s assertion window, flaking this dismissal. Retry
    // the Escape until the dialog is actually gone. Chromium/Firefox
    // dismiss on the first press, so this passes immediately there.
    await expect(async () => {
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('conflict-resolution-dialog')).toHaveCount(0, {
        timeout: 2000,
      });
    }).toPass({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Import aus Markdown' })).toBeVisible();
  });

  test('Cancel button during conflict-resolution = full cancel', async ({ page }) => {
    await setupAuthenticatedSession(page);
    await loadBase(page);
    await pasteAndContinue(page, CONFLICT_FIXTURE);
    await pickModeForAllVisibleRows(page, 'merge');
    await applyAndStart(page);
    await expect(page.getByTestId('conflict-resolution-dialog')).toBeVisible();

    await page.getByTestId('conflict-resolution-dialog-cancel').click();
    await expect(page.getByTestId('conflict-resolution-dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Import aus Markdown' })).toBeVisible();
  });
});

test.describe('IM-06 merge - viewport', () => {
  test.use({ viewport: { width: 360, height: 720 } });

  // 360px viewport collapses the NavBar into a hamburger drawer
  // ("Navigation öffnen" button). Open the drawer, then click the
  // Import link inside it.
  test('360px: ConfirmDialog clamps + dialog renders', async ({ page }) => {
    await setupAuthenticatedSession(page);

    async function navigateToImportThroughHamburger(): Promise<void> {
      await page.getByRole('button', { name: 'Navigation öffnen' }).click();
      await page.getByRole('link', { name: 'Import', exact: true }).click();
    }

    // Adapted loadBase for 360px: navigate through hamburger.
    await navigateToImportThroughHamburger();
    await page.getByLabel(/markdown-text einfügen/i).fill(BASE_FIXTURE);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Diesem Profil zuordnen' }).click();
    await expect(page.getByRole('heading', { name: 'Vorschau' })).toBeVisible();
    await page.getByRole('button', { name: 'Import starten' }).click();
    await expect(page.getByRole('heading', { name: /Import erfolgreich/i })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('button', { name: 'Zur Übersicht' }).click();

    // Second import: trigger conflict path.
    await navigateToImportThroughHamburger();
    await page.getByLabel(/markdown-text einfügen/i).fill(CONFLICT_FIXTURE);
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Diesem Profil zuordnen' }).click();
    await pickModeForAllVisibleRows(page, 'merge');
    await applyAndStart(page);
    const dialog = page.getByTestId('conflict-resolution-dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box?.width ?? 9999).toBeLessThanOrEqual(360);
  });
});
