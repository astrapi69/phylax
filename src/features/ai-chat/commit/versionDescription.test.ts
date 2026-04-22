import { describe, it, expect } from 'vitest';
import i18n from '../../../i18n/config';
import type { ProfileDiff } from './computeDiff';
import { buildVersionDescription } from './versionDescription';

const t = i18n.getFixedT('de', 'ai-chat');

function emptyDiff(): ProfileDiff {
  return {
    observations: { new: [], changed: [], unchanged: [] },
    supplements: { new: [], changed: [], unchanged: [] },
    openPoints: { new: [] },
    warnings: [],
  };
}

describe('buildVersionDescription', () => {
  it('generates from an all-new observation diff', () => {
    const diff = emptyDiff();
    diff.observations.new.push(
      // Partial shape is fine; buildVersionDescription only reads `theme`.
      { theme: 'Knie rechts' } as ProfileDiff['observations']['new'][number],
      { theme: 'Schulter links' } as ProfileDiff['observations']['new'][number],
    );
    expect(buildVersionDescription(t, diff)).toBe('KI-Update: Knie rechts neu, Schulter links neu');
  });

  it('generates from a changed-only diff with theme names from the existing record', () => {
    const diff = emptyDiff();
    diff.observations.changed.push({
      existing: {
        theme: 'Linke Schulter',
      } as ProfileDiff['observations']['changed'][number]['existing'],
      incoming: {
        theme: 'Linke Schulter',
      } as ProfileDiff['observations']['changed'][number]['incoming'],
      merged: {
        theme: 'Linke Schulter',
      } as ProfileDiff['observations']['changed'][number]['merged'],
      fieldsChanged: ['status'],
    });
    expect(buildVersionDescription(t, diff)).toBe('KI-Update: Linke Schulter aktualisiert');
  });

  it('combines new + changed + supplements + open points', () => {
    const diff = emptyDiff();
    diff.observations.new.push({
      theme: 'Knie rechts',
    } as ProfileDiff['observations']['new'][number]);
    diff.observations.changed.push({
      existing: {
        theme: 'Linke Schulter',
      } as ProfileDiff['observations']['changed'][number]['existing'],
      incoming: {
        theme: 'Linke Schulter',
      } as ProfileDiff['observations']['changed'][number]['incoming'],
      merged: {
        theme: 'Linke Schulter',
      } as ProfileDiff['observations']['changed'][number]['merged'],
      fieldsChanged: ['status'],
    });
    diff.supplements.new.push({
      name: 'Magnesium 400',
    } as ProfileDiff['supplements']['new'][number]);
    diff.openPoints.new.push(
      { text: 'TSH-Wert nachmessen' } as ProfileDiff['openPoints']['new'][number],
      { text: 'MRT Knie' } as ProfileDiff['openPoints']['new'][number],
    );
    expect(buildVersionDescription(t, diff)).toBe(
      'KI-Update: Knie rechts neu, Linke Schulter aktualisiert, 1 Supplement, 2 Punkte',
    );
  });

  it('returns "keine Änderungen" for an empty diff', () => {
    expect(buildVersionDescription(t, emptyDiff())).toBe('KI-Update: keine Änderungen');
  });

  it('pluralizes supplements and open points correctly', () => {
    const single = emptyDiff();
    single.supplements.new.push({
      name: 'Vitamin D3',
    } as ProfileDiff['supplements']['new'][number]);
    single.openPoints.new.push({ text: 'X' } as ProfileDiff['openPoints']['new'][number]);
    expect(buildVersionDescription(t, single)).toBe('KI-Update: 1 Supplement, 1 Punkt');

    const plural = emptyDiff();
    plural.supplements.new.push(
      { name: 'A' } as ProfileDiff['supplements']['new'][number],
      { name: 'B' } as ProfileDiff['supplements']['new'][number],
    );
    plural.openPoints.new.push(
      { text: 'X' } as ProfileDiff['openPoints']['new'][number],
      { text: 'Y' } as ProfileDiff['openPoints']['new'][number],
      { text: 'Z' } as ProfileDiff['openPoints']['new'][number],
    );
    expect(buildVersionDescription(t, plural)).toBe('KI-Update: 2 Supplemente, 3 Punkte');
  });

  it('counts new + changed supplements together', () => {
    const diff = emptyDiff();
    diff.supplements.new.push({ name: 'A' } as ProfileDiff['supplements']['new'][number]);
    diff.supplements.changed.push({
      existing: { name: 'B' } as ProfileDiff['supplements']['changed'][number]['existing'],
      incoming: { name: 'B' } as ProfileDiff['supplements']['changed'][number]['incoming'],
      merged: { name: 'B' } as ProfileDiff['supplements']['changed'][number]['merged'],
      fieldsChanged: ['category'],
    });
    expect(buildVersionDescription(t, diff)).toBe('KI-Update: 2 Supplemente');
  });
});
