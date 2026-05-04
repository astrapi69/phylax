import { describe, it, expect } from 'vitest';
import {
  observationKey,
  labReportKey,
  labValueKey,
  supplementKey,
  openPointKey,
  profileVersionKey,
  timelineEntryKey,
} from './naturalKey';

describe('observationKey', () => {
  it('returns the theme verbatim when already trimmed', () => {
    expect(observationKey({ theme: 'Linkes Knie' })).toBe('Linkes Knie');
  });
  it('strips leading and trailing whitespace', () => {
    expect(observationKey({ theme: '  Linkes Knie  ' })).toBe('Linkes Knie');
  });
  it('does NOT collapse internal whitespace (W1: byte-equal v1)', () => {
    expect(observationKey({ theme: 'Linkes  Knie' })).not.toBe('Linkes Knie');
  });
  it('does NOT lowercase (W1: byte-equal v1)', () => {
    expect(observationKey({ theme: 'linkes knie' })).not.toBe('Linkes Knie');
  });
});

describe('labReportKey', () => {
  it('returns the ISO date as the key', () => {
    expect(labReportKey({ reportDate: '2026-04-15' })).toBe('2026-04-15');
  });
  it('trims whitespace around the ISO date', () => {
    expect(labReportKey({ reportDate: ' 2026-04-15 ' })).toBe('2026-04-15');
  });
});

describe('labValueKey', () => {
  it('returns the parameter name', () => {
    expect(labValueKey({ parameter: 'Hämoglobin' })).toBe('Hämoglobin');
  });
  it('trims whitespace', () => {
    expect(labValueKey({ parameter: '  TSH  ' })).toBe('TSH');
  });
});

describe('supplementKey', () => {
  it('returns name only when brand is undefined', () => {
    expect(supplementKey({ name: 'Vitamin D3' })).toBe('Vitamin D3');
  });
  it('returns name|brand composite when brand is present', () => {
    expect(supplementKey({ name: 'Vitamin D3', brand: 'Pure' })).toBe('Vitamin D3|Pure');
  });
  it('treats Vitamin D3 (no brand) and Vitamin D3|Pure as different keys', () => {
    expect(supplementKey({ name: 'Vitamin D3' })).not.toBe(
      supplementKey({ name: 'Vitamin D3', brand: 'Pure' }),
    );
  });
  it('trims name and brand independently', () => {
    expect(supplementKey({ name: '  Magnesium  ', brand: '  Citrat  ' })).toBe('Magnesium|Citrat');
  });
  it('treats empty-string brand as missing brand', () => {
    expect(supplementKey({ name: 'Zink', brand: '   ' })).toBe('Zink');
  });
});

describe('openPointKey', () => {
  it('returns the trimmed context', () => {
    expect(openPointKey({ context: '  Wiederholungs-Blutabnahme  ' })).toBe(
      'Wiederholungs-Blutabnahme',
    );
  });
});

describe('profileVersionKey', () => {
  it('returns the trimmed semantic version', () => {
    expect(profileVersionKey({ version: '1.3.1' })).toBe('1.3.1');
    expect(profileVersionKey({ version: '  2.0  ' })).toBe('2.0');
  });
});

describe('timelineEntryKey', () => {
  it('composes period|title for disambiguation across same-period events', () => {
    expect(timelineEntryKey({ period: 'März 2026', title: 'Brustkorb' })).toBe(
      'März 2026|Brustkorb',
    );
  });
  it('separates two same-period entries with different titles', () => {
    const a = timelineEntryKey({ period: 'März 2026', title: 'Schulter' });
    const b = timelineEntryKey({ period: 'März 2026', title: 'Knie' });
    expect(a).not.toBe(b);
  });
  it('trims period and title independently', () => {
    expect(timelineEntryKey({ period: '  Juni 2025  ', title: '  Sinusitis  ' })).toBe(
      'Juni 2025|Sinusitis',
    );
  });
});
