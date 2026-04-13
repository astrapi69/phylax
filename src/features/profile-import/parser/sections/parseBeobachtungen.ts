import type { ParsedObservation } from '../types';
import type { ParseWarning } from '../types';
import { splitIntoSections } from '../helpers/splitIntoSections';
import { parseLabeledBullets } from '../helpers/parseLabeledBullets';

const CORE_FIELDS: Record<
  string,
  keyof Pick<
    ParsedObservation,
    'fact' | 'pattern' | 'selfRegulation' | 'status' | 'medicalFinding' | 'relevanceNotes'
  >
> = {
  beobachtung: 'fact',
  muster: 'pattern',
  selbstregulation: 'selfRegulation',
  status: 'status',
  'aerztlicher befund': 'medicalFinding',
  '\u00e4rztlicher befund': 'medicalFinding',
};

const RELEVANCE_PATTERN = /^relevanz\s+(fuer|f\u00fcr)\s+/i;

/**
 * Parse the Beobachtungen (observations) section.
 *
 * Each H3 sub-section becomes one Observation. The heading text
 * (with the number prefix stripped) becomes the theme.
 *
 * Labeled bullets are mapped to core fields or extraSections.
 * "(NEU v1.x)" markers are stripped from headings.
 */
export function parseBeobachtungen(content: string): {
  observations: ParsedObservation[];
  warnings: ParseWarning[];
} {
  const subsections = splitIntoSections(content, 3);
  const observations: ParsedObservation[] = [];
  const warnings: ParseWarning[] = [];

  for (const sub of subsections) {
    if (sub.level === 0 || !sub.heading) continue;

    const theme = cleanTheme(sub.heading);
    const bullets = parseLabeledBullets(sub.content);

    const obs: ParsedObservation = {
      theme,
      fact: '',
      pattern: '',
      selfRegulation: '',
      status: '',
      source: 'user',
      extraSections: {},
    };

    for (const bullet of bullets) {
      const labelLower = bullet.label.toLowerCase().trim();

      const coreField = CORE_FIELDS[labelLower];
      if (coreField) {
        obs[coreField] = bullet.value;
        continue;
      }

      if (RELEVANCE_PATTERN.test(labelLower)) {
        obs.relevanceNotes = bullet.value;
        continue;
      }

      // Check for AI or medical source markers
      if (labelLower === 'einschaetzung' || labelLower === 'einsch\u00e4tzung') {
        obs.extraSections[bullet.label] = bullet.value;
        if (/ki-gest\u00fctzt|ki-gestuetzt|ki-basiert/i.test(bullet.value)) {
          obs.source = 'ai';
        }
        continue;
      }

      // Everything else goes to extraSections with original German key
      obs.extraSections[bullet.label] = bullet.value;
    }

    if (!obs.fact && !obs.pattern && !obs.selfRegulation) {
      warnings.push({
        section: theme,
        message: 'Observation has no fact, pattern, or self-regulation fields',
        rawContent: sub.content.substring(0, 200),
      });
    }

    observations.push(obs);
  }

  return { observations, warnings };
}

/**
 * Clean a theme heading:
 * - Strip numbered prefix like "2.1 " or "2.1. "
 * - Strip version markers like "(NEU v1.3)" or "(v1.2)"
 */
function cleanTheme(heading: string): string {
  return heading
    .replace(/^\d+\.\d+\.?\s*/, '')
    .replace(/\s*\((?:NEU\s+)?v[\d.]+\)\s*/g, '')
    .trim();
}
