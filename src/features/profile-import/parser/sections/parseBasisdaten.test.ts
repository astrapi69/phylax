import { describe, it, expect } from 'vitest';
import { parseBasisdaten } from './parseBasisdaten';

describe('parseBasisdaten', () => {
  it('parses all known fields', () => {
    const md = [
      '- **Geburtsdatum:** 28.08.1969',
      '- **Alter:** 56 Jahre (Stand Maerz 2026)',
      '- **Groesse:** 183 cm',
      '- **Gewicht:** 92 kg (Stand Maerz 2026, BMI 27,5)',
      '- **Zielgewicht:** ca. 82 kg (BMI 24,5)',
      '- **Hausarzt:** Dr. med. Max Mueller, Hauptstrasse 1, 12345 Berlin',
    ].join('\n');

    const result = parseBasisdaten(md);
    expect(result.birthDate).toBe('1969-08-28');
    expect(result.age).toBe(56);
    expect(result.heightCm).toBe(183);
    expect(result.weightKg).toBe(92);
    expect(result.targetWeightKg).toBe(82);
    expect(result.primaryDoctor?.name).toBe('Dr. med. Max Mueller');
    expect(result.primaryDoctor?.address).toBe('Hauptstrasse 1, 12345 Berlin');
  });

  it('handles missing fields gracefully', () => {
    const result = parseBasisdaten('- **Alter:** 40 Jahre');
    expect(result.age).toBe(40);
    expect(result.birthDate).toBeUndefined();
    expect(result.heightCm).toBeUndefined();
    expect(result.weightKg).toBeUndefined();
    expect(result.primaryDoctor).toBeUndefined();
  });

  it('collects unknown labels into contextNotes', () => {
    const md = [
      '- **Alter:** 56 Jahre',
      '- **Beruf:** Softwareentwickler',
      '- **Hobbies:** Krafttraining, Wandern',
    ].join('\n');

    const result = parseBasisdaten(md);
    expect(result.contextNotes).toContain('Beruf');
    expect(result.contextNotes).toContain('Hobbies');
  });

  it('captures Gewichtsverlauf as contextNotes', () => {
    const md = '- **Gewichtsverlauf:** 84-89 kg -> 92 kg (Maerz 2026)';
    const result = parseBasisdaten(md);
    expect(result.contextNotes).toContain('Gewichtsverlauf');
    expect(result.weightHistory).toEqual([]);
  });

  it('parses doctor without address', () => {
    const md = '- **Hausarzt:** Dr. med. Max Mueller';
    const result = parseBasisdaten(md);
    expect(result.primaryDoctor?.name).toBe('Dr. med. Max Mueller');
    expect(result.primaryDoctor?.address).toBeUndefined();
  });

  it('profileType is undefined (set by import, not parser)', () => {
    const result = parseBasisdaten('- **Alter:** 40');
    expect(result.profileType).toBeUndefined();
  });

  it('returns empty arrays for list fields when absent', () => {
    const result = parseBasisdaten('');
    expect(result.knownDiagnoses).toEqual([]);
    expect(result.currentMedications).toEqual([]);
    expect(result.relevantLimitations).toEqual([]);
    expect(result.weightHistory).toEqual([]);
  });

  it('parses comma-separated diagnoses', () => {
    const md = '- **Bekannte Diagnosen:** Impingement links, Veneninsuffizienz, Reflux';
    const result = parseBasisdaten(md);
    expect(result.knownDiagnoses).toEqual(['Impingement links', 'Veneninsuffizienz', 'Reflux']);
  });
});
