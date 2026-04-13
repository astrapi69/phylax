import { describe, it, expect } from 'vitest';
import { parseBlutwerte } from './parseBlutwerte';

describe('parseBlutwerte', () => {
  it('parses a report with metadata and values', () => {
    const md = [
      '### Befund vom 27.02.2026',
      '- **Labor:** MVZ Labor Ludwigsburg',
      '- **Arzt:** Dr. med. Max Mueller',
      '- **Befundnr.:** LAB-2026-001',
      '',
      '### Kleines Blutbild',
      '| Parameter | Ergebnis | Einheit | Referenz | Bewertung |',
      '|-----------|----------|---------|----------|-----------|',
      '| Leukozyten | 6,04 | G/l | 3,90-10,20 | Normal |',
      '| Erythrozyten | 4,83 | T/l | 4,30-5,80 | Normal |',
    ].join('\n');

    const { labReports, labValues } = parseBlutwerte(md);
    expect(labReports).toHaveLength(1);
    expect(labReports[0]?.reportDate).toBe('2026-02-27');
    expect(labReports[0]?.labName).toBe('MVZ Labor Ludwigsburg');
    expect(labReports[0]?.doctorName).toBe('Dr. med. Max Mueller');
    expect(labReports[0]?.reportNumber).toBe('LAB-2026-001');

    expect(labValues).toHaveLength(2);
    expect(labValues[0]?.category).toBe('Kleines Blutbild');
    expect(labValues[0]?.parameter).toBe('Leukozyten');
    expect(labValues[0]?.result).toBe('6,04');
    expect(labValues[0]?.unit).toBe('G/l');
    expect(labValues[0]?.referenceRange).toBe('3,90-10,20');
    expect(labValues[0]?.assessment).toBe('Normal');
    expect(labValues[0]?.reportIndex).toBe(0);
  });

  it('parses multiple categories', () => {
    const md = [
      '### Befund vom 15.03.2026',
      '',
      '### Blutbild',
      '| Parameter | Ergebnis | Einheit | Referenz | Bewertung |',
      '|-----------|----------|---------|----------|-----------|',
      '| Hb | 14.2 | g/dl | 13.5-17.5 | Normal |',
      '',
      '### Nierenwerte',
      '| Parameter | Ergebnis | Einheit | Referenz | Bewertung |',
      '|-----------|----------|---------|----------|-----------|',
      '| Kreatinin | 0,95 | mg/dl | 0,67-1,17 | Normal |',
    ].join('\n');

    const { labValues } = parseBlutwerte(md);
    expect(labValues).toHaveLength(2);
    expect(labValues[0]?.category).toBe('Blutbild');
    expect(labValues[1]?.category).toBe('Nierenwerte');
  });

  it('parses non-numeric results', () => {
    const md = [
      '### Befund vom 01.01.2026',
      '',
      '### Serologie',
      '| Parameter | Ergebnis | Einheit | Referenz | Bewertung |',
      '|-----------|----------|---------|----------|-----------|',
      '| HBs-Antigen | negativ | | | Normal |',
      '| Titer | >100 | IU/l | | Positiv |',
    ].join('\n');

    const { labValues } = parseBlutwerte(md);
    expect(labValues[0]?.result).toBe('negativ');
    expect(labValues[1]?.result).toBe('>100');
  });

  it('parses category assessments', () => {
    const md = [
      '### Befund vom 01.01.2026',
      '',
      '### Blutbild',
      '| Parameter | Ergebnis | Einheit | Referenz | Bewertung |',
      '|-----------|----------|---------|----------|-----------|',
      '| Hb | 14.2 | g/dl | 13.5-17.5 | Normal |',
      '',
      '**Einschaetzung Blutbild:** Alle Werte unauffaellig.',
    ].join('\n');

    const { labReports } = parseBlutwerte(md);
    expect(labReports[0]?.categoryAssessments['Blutbild']).toBe('Alle Werte unauffaellig.');
  });

  it('handles empty section', () => {
    const { labReports, labValues } = parseBlutwerte('');
    expect(labReports).toEqual([]);
    expect(labValues).toEqual([]);
  });

  it('assigns correct reportIndex to values across reports', () => {
    const md = [
      '### Befund vom 01.01.2025',
      '',
      '### Blutbild',
      '| Parameter | Ergebnis | Einheit | Referenz | Bewertung |',
      '|-----------|----------|---------|----------|-----------|',
      '| Hb | 13.5 | g/dl | 13.5-17.5 | Normal |',
      '',
      '### Befund vom 01.01.2026',
      '',
      '### Blutbild',
      '| Parameter | Ergebnis | Einheit | Referenz | Bewertung |',
      '|-----------|----------|---------|----------|-----------|',
      '| Hb | 14.2 | g/dl | 13.5-17.5 | Normal |',
    ].join('\n');

    const { labReports, labValues } = parseBlutwerte(md);
    expect(labReports).toHaveLength(2);
    expect(labValues).toHaveLength(2);
    expect(labValues[0]?.reportIndex).toBe(0);
    expect(labValues[1]?.reportIndex).toBe(1);
  });
});
