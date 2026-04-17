import { describe, it, expect } from 'vitest';
import { parseProfile } from '../../profile-import/parser';
import { detectProfileFragment } from './detectProfileFragment';
import { wrapFragmentForParser } from './wrapFragment';

function requireFragment(raw: string) {
  const fragment = detectProfileFragment(raw);
  if (!fragment) throw new Error('expected a detected fragment');
  return fragment;
}

describe('wrapFragmentForParser', () => {
  it('emits a profile skeleton with a Beobachtungen section when observations are present', () => {
    const fragment = requireFragment(
      `### Linke Schulter\n- **Status:** Akut\n- **Beobachtung:** Druckschmerz`,
    );
    const wrapped = wrapFragmentForParser(fragment);

    expect(wrapped.startsWith('# Profil: AI-Fragment')).toBe(true);
    expect(wrapped).toContain('## Beobachtungen');
    expect(wrapped).toContain('### Linke Schulter');
  });

  it('observation output round-trips through parseProfile into a real Observation', () => {
    const fragment = requireFragment(
      `### Knie rechts\n- **Status:** Akut\n- **Beobachtung:** Schmerzen nach Lauftraining\n- **Muster:** Belastungsabhaengig\n- **Selbstregulation:** Laufschuh-Check`,
    );
    const wrapped = wrapFragmentForParser(fragment);
    const result = parseProfile(wrapped);

    expect(result.observations).toHaveLength(1);
    const obs = result.observations[0];
    expect(obs?.theme).toBe('Knie rechts');
    expect(obs?.status).toBe('Akut');
    expect(obs?.fact).toBe('Schmerzen nach Lauftraining');
    expect(obs?.pattern).toBe('Belastungsabhaengig');
    expect(obs?.selfRegulation).toBe('Laufschuh-Check');
  });

  it('mixed fragment (observation + supplement table + open-points context) round-trips', () => {
    const message = `### Knie rechts
- **Status:** Akut
- **Beobachtung:** Schmerzen nach Lauftraining

## Supplemente

| Kategorie | Praeparat |
| --- | --- |
| taeglich | Magnesium 400 |

## Offene Punkte

### Laufen
- Laufschuh-Check
- Physio-Termin vereinbaren`;

    const fragment = requireFragment(message);
    const wrapped = wrapFragmentForParser(fragment);
    const result = parseProfile(wrapped);

    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]?.theme).toBe('Knie rechts');
    expect(result.supplements).toHaveLength(1);
    expect(result.supplements[0]?.name).toBe('Magnesium 400');
    expect(result.supplements[0]?.category).toBe('daily');
    expect(result.openPoints).toHaveLength(2);
    expect(result.openPoints[0]?.context).toBe('Laufen');
  });

  it('emits only the sections present in the fragment (no empty scaffolding)', () => {
    const fragment = requireFragment(
      `## Supplemente\n\n| Kategorie | Praeparat |\n| --- | --- |\n| taeglich | Vitamin D3 |`,
    );
    const wrapped = wrapFragmentForParser(fragment);

    expect(wrapped).toContain('## Supplemente');
    expect(wrapped).not.toContain('## Beobachtungen');
    expect(wrapped).not.toContain('## Offene Punkte');
  });
});
