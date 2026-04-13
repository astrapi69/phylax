import type { ParsedOpenPoint } from '../types';
import { splitIntoSections } from '../helpers/splitIntoSections';

const PRIORITY_PATTERN = /\(Priorit(?:ae|\u00e4)t(?::\s*(.+?))?\)/i;

/**
 * Parse the Offene Punkte (open points) section.
 *
 * Each H3 sub-section is a context group. Bullet items within
 * become individual open points. All start as unresolved.
 */
export function parseOffenePunkte(content: string): ParsedOpenPoint[] {
  const subsections = splitIntoSections(content, 3);
  const points: ParsedOpenPoint[] = [];

  for (const sub of subsections) {
    if (sub.level === 0 || !sub.heading) continue;

    // Extract priority from heading like "Blutabnahme (Prioritaet)"
    let context = sub.heading;
    let priority: string | undefined;
    const priorityMatch = PRIORITY_PATTERN.exec(context);
    if (priorityMatch) {
      priority = priorityMatch[1]?.trim() || 'Hoch';
      context = context.replace(PRIORITY_PATTERN, '').trim();
    }

    // Extract bullets
    const bullets = extractBullets(sub.content);

    if (bullets.length === 0) {
      // No bullets: treat the whole content as one point
      if (sub.content.trim()) {
        points.push({
          text: sub.content.trim(),
          context,
          resolved: false,
          priority,
        });
      }
      continue;
    }

    for (const bullet of bullets) {
      points.push({
        text: bullet,
        context,
        resolved: false,
        priority,
      });
    }
  }

  return points;
}

function extractBullets(content: string): string[] {
  const bullets: string[] = [];
  const lines = content.split('\n');
  let currentBullet: string[] = [];

  for (const line of lines) {
    const isBulletStart = /^[-*]\s+/.test(line.trim());

    if (isBulletStart) {
      if (currentBullet.length > 0) {
        bullets.push(currentBullet.join('\n').trim());
      }
      currentBullet = [line.trim().replace(/^[-*]\s+/, '')];
    } else if (currentBullet.length > 0 && line.trim()) {
      currentBullet.push(line.trim());
    }
  }

  if (currentBullet.length > 0) {
    bullets.push(currentBullet.join('\n').trim());
  }

  return bullets;
}
