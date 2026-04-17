import type { Profile, Observation } from '../../../domain';
import { getDisplayName } from '../../../domain';

/**
 * Concise, prompt-friendly summary of the current profile state.
 *
 * Injected into the system prompt so the AI knows what already exists and
 * can suggest where new information fits (avoids duplicate observations,
 * lets the model reference existing themes, etc.).
 *
 * Scope is deliberately narrow: name, age, diagnoses, observation themes,
 * last update, proxy context. Medications, supplements, open points, and
 * lab reports are excluded to keep the prompt short; the AI can ask about
 * those during conversation.
 */
export interface ProfileSummary {
  name: string;
  age?: number;
  knownDiagnoses: string[];
  existingThemes: string[];
  lastUpdate?: string;
  isProxy: boolean;
  managedBy?: string;
}

/**
 * Build a ProfileSummary from the current profile and its observations.
 * The caller is responsible for loading observations; this module stays
 * pure (no Dexie, no async).
 */
export function extractProfileSummary(
  profile: Profile,
  observations: Observation[],
): ProfileSummary {
  const isProxy = profile.baseData.profileType === 'proxy';
  const managedBy = profile.baseData.managedBy?.trim()
    ? profile.baseData.managedBy.trim()
    : undefined;

  const themes = Array.from(new Set(observations.map((o) => o.theme).filter(Boolean)));
  const collator = new Intl.Collator('de');
  themes.sort((a, b) => collator.compare(a, b));

  const summary: ProfileSummary = {
    name: getDisplayName(profile),
    knownDiagnoses: profile.baseData.knownDiagnoses,
    existingThemes: themes,
    isProxy,
    lastUpdate: formatIsoDate(profile.updatedAt),
  };
  if (typeof profile.baseData.age === 'number') {
    summary.age = profile.baseData.age;
  }
  if (managedBy) {
    summary.managedBy = managedBy;
  }
  return summary;
}

/**
 * Render a ProfileSummary as a short bulleted block for injection into
 * the system prompt. Missing fields are omitted. A profile with no
 * structured content (no age, diagnoses, or observation themes) produces
 * a single-line "no entries yet" fallback so the AI still knows the
 * profile exists but has nothing to reference.
 */
export function formatProfileSummary(summary: ProfileSummary): string {
  const hasStructuredContent =
    summary.age !== undefined ||
    summary.knownDiagnoses.length > 0 ||
    summary.existingThemes.length > 0;

  if (!hasStructuredContent) {
    return 'Aktuelles Profil: (noch keine Angaben)';
  }

  const lines: string[] = ['Aktuelles Profil:'];
  lines.push(`- Name: ${summary.name}`);
  if (summary.age !== undefined) {
    lines.push(`- Alter: ${summary.age} Jahre`);
  }
  if (summary.knownDiagnoses.length > 0) {
    lines.push(`- Bekannte Diagnosen: ${summary.knownDiagnoses.join(', ')}`);
  }
  if (summary.existingThemes.length > 0) {
    lines.push(`- Bestehende Beobachtungsthemen: ${summary.existingThemes.join(', ')}`);
  }
  if (summary.isProxy && summary.managedBy) {
    lines.push(`- Betreuer/in: ${summary.managedBy}`);
  }
  if (summary.lastUpdate) {
    lines.push(`- Letzte Aktualisierung: ${summary.lastUpdate}`);
  }

  return lines.join('\n');
}

function formatIsoDate(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
