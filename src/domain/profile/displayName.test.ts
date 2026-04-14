import { describe, it, expect } from 'vitest';
import { getDisplayName } from './displayName';
import type { Profile } from './types';

function profile(overrides: Partial<Profile['baseData']>): Pick<Profile, 'baseData'> {
  return {
    baseData: {
      weightHistory: [],
      knownDiagnoses: [],
      currentMedications: [],
      relevantLimitations: [],
      profileType: 'self',
      ...overrides,
    },
  };
}

describe('getDisplayName', () => {
  it('returns the explicit name when set', () => {
    expect(getDisplayName(profile({ name: 'Mein Gesundheitsprofil' }))).toBe(
      'Mein Gesundheitsprofil',
    );
  });

  it('trims whitespace from the explicit name', () => {
    expect(getDisplayName(profile({ name: '  Asterios  ' }))).toBe('Asterios');
  });

  it('falls back to "Mein Profil" for a self profile without a name', () => {
    expect(getDisplayName(profile({}))).toBe('Mein Profil');
  });

  it('falls back to "Mein Profil" when name is empty string', () => {
    expect(getDisplayName(profile({ name: '' }))).toBe('Mein Profil');
  });

  it('falls back to "Mein Profil" when name is whitespace only', () => {
    expect(getDisplayName(profile({ name: '   ' }))).toBe('Mein Profil');
  });

  it('uses managedBy for proxy profiles without a name', () => {
    expect(getDisplayName(profile({ profileType: 'proxy', managedBy: 'Mutter' }))).toBe(
      'Profil von Mutter',
    );
  });

  it('falls back to "Stellvertreterprofil" when proxy has neither name nor managedBy', () => {
    expect(getDisplayName(profile({ profileType: 'proxy' }))).toBe('Stellvertreterprofil');
  });

  it('falls back to "Stellvertreterprofil" when proxy managedBy is whitespace', () => {
    expect(getDisplayName(profile({ profileType: 'proxy', managedBy: '   ' }))).toBe(
      'Stellvertreterprofil',
    );
  });

  it('explicit name overrides proxy fallbacks', () => {
    expect(
      getDisplayName(profile({ name: 'Omas Profil', profileType: 'proxy', managedBy: 'Anna' })),
    ).toBe('Omas Profil');
  });
});
