/**
 * File name convention for every Befaro export. YYYY-MM-DD date suffix so
 * exports sort chronologically in a file manager.
 *
 * - Profile exports use the "befaro-profil-" base (shared between .md and .pdf).
 * - Lab-values CSV uses the "befaro-labor-" base because it is a lab-only
 *   export, not a full profile.
 */

function formatDate(now: Date): string {
  const iso = now.toISOString();
  return iso.slice(0, 10);
}

export function generateMarkdownFilename(now: Date = new Date()): string {
  return `befaro-profil-${formatDate(now)}.md`;
}

export function generatePdfFilename(now: Date = new Date()): string {
  return `befaro-profil-${formatDate(now)}.pdf`;
}

export function generateCsvFilename(now: Date = new Date()): string {
  return `befaro-labor-${formatDate(now)}.csv`;
}
