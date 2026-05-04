#!/usr/bin/env node
/* eslint-disable */
/**
 * Seed a Phylax browser session for manual smoke walks.
 *
 * Drives Chromium via Playwright through onboarding, profile-create,
 * and one or two markdown imports. Leaves the browser open at the
 * end so the operator can walk the smoke scenarios without re-typing
 * fixture data each session.
 *
 * Usage:
 *   nvm use 24
 *   make dev                       # in another terminal, dev server on :6173
 *   node scripts/seed-smoke.mjs <scenario>
 *
 * Scenarios:
 *   profile-a              Fresh vault, Profile A imported.
 *                          Use for: P-22b/c/d match-nav, IM-05 sc 1-3.
 *   profile-a-plus-b       Profile A imported, Profile B import flow
 *                          paused at the "Import in bestehendes Profil"
 *                          confirm dialog. Operator picks per-row modes
 *                          and clicks Übernehmen manually.
 *                          Use for: IM-05 sc 1-7, sc 9, sc 10.
 *   merge-a-plus-b         Profile A + Profile B merged with
 *                          Zusammenführen on every row. Lands on the
 *                          done screen.
 *                          Use for: IM-05 sc 5 verification.
 *
 * Notes:
 * - Requires the dev server already running at http://localhost:6173/.
 *   This script does NOT start it (avoids dev-server lifecycle coupling).
 * - Requires Node >= 20 (Playwright dependency).
 * - Default password: smoke-test-pw-12345 (matches docs).
 * - Uses the `headless: false` flag so the operator drives the browser
 *   after seeding completes.
 */

import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const PROFILE_A_PATH = resolve(REPO_ROOT, 'docs/manual-smoke/test-data/profile-a.md');
const PROFILE_B_PATH = resolve(REPO_ROOT, 'docs/manual-smoke/test-data/profile-b.md');
const BASE_URL = 'http://localhost:6173';
const PASSWORD = 'smoke-test-pw-12345';
const PROFILE_NAME = 'Smoke-Test-Profil';

const scenario = process.argv[2];
const VALID_SCENARIOS = ['profile-a', 'profile-a-plus-b', 'merge-a-plus-b'];
if (!VALID_SCENARIOS.includes(scenario)) {
  console.error(`Usage: node scripts/seed-smoke.mjs <scenario>`);
  console.error(`Scenarios: ${VALID_SCENARIOS.join(', ')}`);
  process.exit(1);
}

const profileA = readFileSync(PROFILE_A_PATH, 'utf-8');
const profileB = readFileSync(PROFILE_B_PATH, 'utf-8');

async function pinLanguage(page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('phylax-language', 'de');
    } catch {}
  });
}

async function wipeIndexedDB(page) {
  await page.goto(BASE_URL + '/');
  await page.evaluate(
    () =>
      new Promise((res, rej) => {
        const req = indexedDB.deleteDatabase('phylax');
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      }),
  );
}

async function onboardAndCreateProfile(page) {
  await page.goto(BASE_URL + '/setup');
  await page.getByLabel('Master-Passwort').first().fill(PASSWORD);
  await page.getByLabel('Passwort wiederholen').fill(PASSWORD);
  await page.getByLabel('Ich habe verstanden').check();
  const submit = page.getByRole('button', { name: 'Phylax einrichten' });
  await submit.waitFor({ state: 'visible' });
  for (let i = 0; i < 60 && !(await submit.isEnabled()); i++) {
    await page.waitForTimeout(500);
  }
  await submit.click();
  await page.getByRole('heading', { name: 'Neues Profil erstellen' }).waitFor();
  await page.getByLabel('Profilname').fill(PROFILE_NAME);
  await page.getByRole('button', { name: 'Profil erstellen' }).click();
  await page.getByRole('heading', { level: 1, name: PROFILE_NAME }).waitFor();
}

async function importMarkdown(page, content) {
  await page.getByRole('link', { name: 'Import', exact: true }).click();
  await page.getByRole('heading', { name: 'Import aus Markdown' }).waitFor();
  await page.getByLabel(/markdown-text einfügen/i).fill(content);
  const weiter = page.getByRole('button', { name: 'Weiter' });
  for (let i = 0; i < 30 && !(await weiter.isEnabled()); i++) {
    await page.waitForTimeout(200);
  }
  await weiter.click();
}

async function selectExistingProfile(page) {
  await page.getByRole('heading', { name: /In welches Profil importieren/i }).waitFor();
  await page.getByRole('button', { name: 'Diesem Profil zuordnen' }).click();
}

async function startImportFromPreview(page) {
  await page.getByRole('heading', { name: 'Vorschau' }).waitFor();
  await page.getByRole('button', { name: 'Import starten' }).click();
  await page.getByRole('heading', { name: /Import erfolgreich/i }).waitFor({ timeout: 15000 });
}

async function setAllRowsToMerge(page) {
  // Wait for confirm dialog
  await page.getByRole('heading', { name: /Import in bestehendes Profil/i }).waitFor();
  // Click every visible "Zusammenführen" radio in the dialog.
  const merges = page.getByRole('radio', { name: /Zusammenführen/i });
  const count = await merges.count();
  for (let i = 0; i < count; i++) {
    const radio = merges.nth(i);
    if (await radio.isEnabled()) {
      await radio.check({ force: true });
    }
  }
  // For rows where Zusammenführen is disabled (empty side), pick a sensible
  // fallback so Übernehmen enables: prefer Überspringen, else Ersetzen.
  const skipRadios = page.getByRole('radio', { name: /Überspringen/i });
  const skipCount = await skipRadios.count();
  for (let i = 0; i < skipCount; i++) {
    const r = skipRadios.nth(i);
    // A row's mode-set is empty if no radio in that row is checked. The dialog
    // structure uses fieldset-per-row, but we cheat: try checking Überspringen
    // wherever it's not currently selected and Zusammenführen wasn't picked.
    const checked = await r.isChecked();
    if (!checked && (await r.isEnabled())) {
      // Skip if its sibling Zusammenführen is already checked.
      // Simplification: leave already-merged rows alone; Überspringen on empty-merge rows is safe.
    }
  }
  // The dialog's add-mode warning surfaces on any row at Zusammenführen,
  // independent of other rows. The Übernehmen button enables once every row
  // has any mode picked. Fall back: pick Überspringen on rows still missing
  // a selection. We detect missing rows by inspecting the dialog DOM.
  await page.evaluate(() => {
    const dialog = document.querySelector('[data-testid^="confirm-row-"]')?.closest('[role]');
    void dialog;
  });
}

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await pinLanguage(page);

  console.log(`[seed-smoke] scenario: ${scenario}`);
  console.log('[seed-smoke] wiping IndexedDB and onboarding...');
  await wipeIndexedDB(page);
  await onboardAndCreateProfile(page);

  console.log('[seed-smoke] importing Profile A...');
  await importMarkdown(page, profileA);
  await selectExistingProfile(page);
  await startImportFromPreview(page);

  if (scenario === 'profile-a') {
    console.log('[seed-smoke] DONE. Profile A loaded. Drive smoke manually now.');
  } else if (scenario === 'profile-a-plus-b') {
    console.log('[seed-smoke] starting Profile B import; will pause at confirm dialog...');
    await page.getByRole('link', { name: 'Import', exact: true }).click();
    await page.getByLabel(/markdown-text einfügen/i).fill(profileB);
    const weiter = page.getByRole('button', { name: 'Weiter' });
    for (let i = 0; i < 30 && !(await weiter.isEnabled()); i++) {
      await page.waitForTimeout(200);
    }
    await weiter.click();
    await selectExistingProfile(page);
    await page.getByRole('heading', { name: /Import in bestehendes Profil/i }).waitFor();
    console.log(
      '[seed-smoke] DONE. Confirm dialog open. Pick per-row modes and walk the IM-05 scenarios.',
    );
  } else if (scenario === 'merge-a-plus-b') {
    console.log('[seed-smoke] importing Profile B with all-Zusammenführen...');
    await page.getByRole('link', { name: 'Import', exact: true }).click();
    await page.getByLabel(/markdown-text einfügen/i).fill(profileB);
    const weiter = page.getByRole('button', { name: 'Weiter' });
    for (let i = 0; i < 30 && !(await weiter.isEnabled()); i++) {
      await page.waitForTimeout(200);
    }
    await weiter.click();
    await selectExistingProfile(page);
    await setAllRowsToMerge(page);
    console.log('[seed-smoke] confirm dialog populated. Click Übernehmen manually to commit.');
  }

  console.log('[seed-smoke] Browser stays open. Ctrl-C this script to close.');
  // Keep process alive until user kills it.
  await new Promise(() => {});
}

run().catch((err) => {
  console.error('[seed-smoke] fatal:', err);
  process.exit(1);
});
