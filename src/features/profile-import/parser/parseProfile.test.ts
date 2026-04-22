import { describe, it, expect } from 'vitest';
import { parseProfile } from './parseProfile';
import exampleProfileV131 from '../../../../tests/fixtures/example-profile-v1.3.1.md?raw';

describe('parseProfile', () => {
  describe('basic parsing', () => {
    it('returns empty result for empty input', () => {
      const result = parseProfile('');
      expect(result.profile).toBeNull();
      expect(result.observations).toEqual([]);
      expect(result.labReports).toEqual([]);
      expect(result.labValues).toEqual([]);
      expect(result.supplements).toEqual([]);
      expect(result.openPoints).toEqual([]);
      expect(result.profileVersions).toEqual([]);
      expect(result.timelineEntries).toEqual([]);
      expect(result.originalMarkdown).toBe('');
    });

    it('preserves originalMarkdown', () => {
      const md = '## 1. Basisdaten\n- **Alter:** 40';
      const result = parseProfile(md);
      expect(result.originalMarkdown).toBe(md);
    });

    it('parses basisdaten into profile', () => {
      const md = [
        '## 1. Basisdaten',
        '- **Geburtsdatum:** 28.08.1969',
        '- **Alter:** 56 Jahre',
        '- **Groesse:** 183 cm',
        '- **Gewicht:** 92 kg',
      ].join('\n');

      const result = parseProfile(md);
      expect(result.profile).not.toBeNull();
      expect(result.profile?.baseData.birthDate).toBe('1969-08-28');
      expect(result.profile?.baseData.age).toBe(56);
      expect(result.profile?.baseData.heightCm).toBe(183);
      expect(result.profile?.baseData.weightKg).toBe(92);
    });

    it('parses observations', () => {
      const md = [
        '## 2. Relevante Vorgeschichte',
        '### 2.1 Linkes Knie',
        '- **Beobachtung:** Schmerzen bei Belastung.',
        '- **Muster:** Belastungsabhaengig.',
        '- **Selbstregulation:** Training angepasst.',
        '- **Status:** Chronisch',
        '### 2.2 Schulter',
        '- **Beobachtung:** Schmerz bei Ueberkopfarbeit.',
        '- **Muster:** Nur unter Last.',
        '- **Selbstregulation:** Uebungen angepasst.',
        '- **Status:** Stabil',
      ].join('\n');

      const result = parseProfile(md);
      expect(result.observations).toHaveLength(2);
      expect(result.observations[0]?.theme).toBe('Linkes Knie');
      expect(result.observations[1]?.theme).toBe('Schulter');
    });

    it('parses lab reports and values', () => {
      const md = [
        '## 3. Blutwerte',
        '### Befund vom 27.02.2026',
        '- **Labor:** Synlab',
        '',
        '### Blutbild',
        '| Parameter | Ergebnis | Einheit | Referenz | Bewertung |',
        '|-----------|----------|---------|----------|-----------|',
        '| Hb | 14.2 | g/dl | 13.5-17.5 | Normal |',
        '| Leuko | 6,04 | G/l | 3,9-10,2 | Normal |',
      ].join('\n');

      const result = parseProfile(md);
      expect(result.labReports).toHaveLength(1);
      expect(result.labReports[0]?.labName).toBe('Synlab');
      expect(result.labValues).toHaveLength(2);
      expect(result.labValues[0]?.parameter).toBe('Hb');
    });

    it('parses supplements', () => {
      const md = [
        '## 5. Vertraeglichkeiten',
        '| Kategorie | Praeparat | Empfehlung | Begruendung |',
        '|-----------|-----------|------------|-------------|',
        '| **Beibehalten (taeglich)** | Vitamin D3 2000 IE (tetesept) | Morgens | Bluttest |',
        '| **Pausiert** | Zink | | Ueberdosierung |',
      ].join('\n');

      const result = parseProfile(md);
      expect(result.supplements).toHaveLength(2);
      expect(result.supplements[0]?.name).toBe('Vitamin D3 2000 IE');
      expect(result.supplements[0]?.brand).toBe('tetesept');
      expect(result.supplements[1]?.category).toBe('paused');
    });

    it('parses open points', () => {
      const md = [
        '## 11. Offene Punkte und naechste Schritte',
        '### Beim naechsten Arztbesuch',
        '- Vitamin D bestimmen',
        '- TSH pruefen',
      ].join('\n');

      const result = parseProfile(md);
      expect(result.openPoints).toHaveLength(2);
      expect(result.openPoints[0]?.context).toBe('Beim naechsten Arztbesuch');
      expect(result.openPoints[0]?.resolved).toBe(false);
    });

    it('parses timeline entries', () => {
      const md = [
        '## 10. Verlaufsnotizen',
        '### Dezember 2024 - Brustkorbbeschwerden',
        '- Kalte Luft als Ausloeser',
        '### Maerz 2026 - Gewichtszunahme',
        '- Plan erstellt',
      ].join('\n');

      const result = parseProfile(md);
      expect(result.timelineEntries).toHaveLength(2);
      expect(result.timelineEntries[0]?.period).toBe('Dezember 2024');
      expect(result.timelineEntries[0]?.title).toBe('Brustkorbbeschwerden');
    });

    it('parses warning signs into profile', () => {
      const md = [
        '## 1. Basisdaten',
        '- **Alter:** 56',
        '',
        '## 7. Warnsignale',
        '- Brustschmerzen bei Belastung',
        '- Ploetzlicher Schwindel',
      ].join('\n');

      const result = parseProfile(md);
      expect(result.profile?.warningSigns).toEqual([
        'Brustschmerzen bei Belastung',
        'Ploetzlicher Schwindel',
      ]);
    });
  });

  describe('metadata extraction', () => {
    it('extracts version from preamble', () => {
      const md = '# Medizinisches Profil - Version 1.3.1\n\n## 1. Basisdaten\n- **Alter:** 56';
      const result = parseProfile(md);
      expect(result.report.metadata.profileVersion).toBe('1.3.1');
      expect(result.profile?.version).toBe('1.3.1');
    });

    it('extracts last update', () => {
      const md = 'Letzte Aktualisierung: Maerz 2026\n\n## 1. Basisdaten\n- **Alter:** 56';
      const result = parseProfile(md);
      expect(result.report.metadata.lastUpdate).toBe('Maerz 2026');
    });

    it('extracts change reason', () => {
      const md = 'Aenderungsgrund v1.3.1: Blutbild ergaenzt\n\n## 1. Basisdaten\n- **Alter:** 56';
      const result = parseProfile(md);
      expect(result.report.metadata.changeReason).toBe('Blutbild ergaenzt');
    });
  });

  describe('report and error handling', () => {
    it('captures unrecognized sections', () => {
      const md = '## 1. Basisdaten\n- **Alter:** 56\n\n## Unbekannte Sektion\nSome content.';
      const result = parseProfile(md);
      expect(result.report.unrecognized).toHaveLength(1);
      expect(result.report.unrecognized[0]?.heading).toBe('Unbekannte Sektion');
    });

    it('lists recognized sections', () => {
      const md = [
        '## 1. Basisdaten',
        '- **Alter:** 56',
        '## 2. Vorgeschichte',
        '### 2.1 Test',
        '- **Beobachtung:** F',
        '- **Muster:** M',
        '- **Selbstregulation:** S',
        '- **Status:** A',
      ].join('\n');

      const result = parseProfile(md);
      expect(result.report.recognized.length).toBeGreaterThanOrEqual(2);
    });

    it('skips Selbstregulationsverhalten (computed, not imported)', () => {
      const md = [
        '## 1. Basisdaten',
        '- **Alter:** 56',
        '## 8. Selbstregulationsverhalten (Zusammenfassung)',
        'Some rollup content.',
      ].join('\n');

      const result = parseProfile(md);
      const skipped = result.report.recognized.find((r) => r.entityType === 'Skipped (computed)');
      expect(skipped).toBeDefined();
    });

    it('profileType is undefined in parsed result', () => {
      const md = '## 1. Basisdaten\n- **Alter:** 56';
      const result = parseProfile(md);
      expect(result.profile?.baseData.profileType).toBeUndefined();
    });

    it('routes a Unicode "Ernährung und Gewicht" heading to the gewichtsmanagement section [TD-09 a]', () => {
      const md = [
        '## 1. Basisdaten',
        '- **Alter:** 56',
        '## 6. Ernährung und Gewicht',
        '### Ausgangslage',
        '- **Beobachtung:** Startgewicht 92 kg',
        '- **Muster:** Moderate Bewegung',
        '- **Selbstregulation:** Kaloriendefizit',
      ].join('\n');

      const result = parseProfile(md);
      // gewichtsmanagement heading is routed to the observations parser,
      // so the observation under ### Ausgangslage should land in results.
      expect(result.observations.length).toBeGreaterThan(0);
      expect(result.observations[0]?.theme).toBe('Ausgangslage');
    });
  });

  describe('integration: real example profile v1.3.1', () => {
    it('parses tests/fixtures/example-profile-v1.3.1.md', () => {
      const markdown = exampleProfileV131;
      const result = parseProfile(markdown);

      // Metadata
      expect(result.report.metadata.profileVersion).toBe('1.3.1');
      expect(result.report.metadata.lastUpdate).toBe('März 2026');
      expect(result.report.metadata.changeReason).toBeDefined();

      // Profile base data
      expect(result.profile).not.toBeNull();
      expect(result.profile?.baseData.birthDate).toBe('1969-09-07');
      expect(result.profile?.baseData.age).toBe(56);
      expect(result.profile?.baseData.heightCm).toBe(183);
      expect(result.profile?.baseData.weightKg).toBe(92);
      expect(result.profile?.version).toBe('1.3.1');

      // Observations: 10 history items (2.1-2.10) + belastungsreaktionen sub-sections + gewichtsmanagement
      expect(result.observations.length).toBeGreaterThanOrEqual(10);

      // Lab report with lab values across multiple tables
      expect(result.labReports).toHaveLength(1);
      expect(result.labReports[0]?.reportDate).toBe('2026-02-27');
      expect(result.labValues.length).toBeGreaterThanOrEqual(20);

      // Supplements from the Einnahmeplan table (9 rows). The Elektrolyt
      // table that follows has a different schema and must not be merged.
      expect(result.supplements).toHaveLength(9);
      expect(result.supplements[0]?.name).toBe('Vitamin D3 2000 IE');
      expect(result.supplements[0]?.brand).toBe('tetesept');

      // Open points across several sub-contexts
      expect(result.openPoints.length).toBeGreaterThan(0);

      // Timeline: 3 entries (Dez 2024, Feb/März 2026, März 2026)
      expect(result.timelineEntries).toHaveLength(3);

      // Profile versions: 5 rows in Versionshistorie
      expect(result.profileVersions).toHaveLength(5);

      // Warning signs captured
      expect(result.profile?.warningSigns.length).toBeGreaterThan(0);

      // External references captured
      expect(result.profile?.externalReferences.length).toBeGreaterThan(0);

      // originalMarkdown preserved for re-export
      expect(result.originalMarkdown).toBe(markdown);
    });
  });
});
