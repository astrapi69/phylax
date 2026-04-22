import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BaseDataSection, ProfileTypeBadge } from './BaseDataSection';
import { makeBaseData } from './test-helpers';

describe('BaseDataSection', () => {
  it('formats birthDate as German locale (TT.MM.JJJJ)', () => {
    render(<BaseDataSection baseData={makeBaseData({ birthDate: '1969-09-07' })} />);
    expect(screen.getByText('07.09.1969')).toBeInTheDocument();
  });

  it('renders age, height and weight with units', () => {
    render(<BaseDataSection baseData={makeBaseData({ age: 56, heightCm: 183, weightKg: 92 })} />);
    expect(screen.getByText('56 Jahre')).toBeInTheDocument();
    expect(screen.getByText('183 cm')).toBeInTheDocument();
    expect(screen.getByText(/92 kg/)).toBeInTheDocument();
  });

  it('shows target weight alongside current weight when set', () => {
    render(<BaseDataSection baseData={makeBaseData({ weightKg: 92, targetWeightKg: 82 })} />);
    expect(screen.getByText(/Ziel: 82 kg/)).toBeInTheDocument();
  });

  it('hides rows for absent fields (no placeholders)', () => {
    const { container } = render(<BaseDataSection baseData={makeBaseData()} />);
    // With no fields and no notes, the whole section collapses.
    expect(container.firstChild).toBeNull();
  });

  it('renders contextNotes via MarkdownContent when present', () => {
    render(
      <BaseDataSection baseData={makeBaseData({ contextNotes: 'Ein **wichtiger** Hinweis' })} />,
    );
    const strong = screen.getByText('wichtiger');
    expect(strong.tagName.toLowerCase()).toBe('strong');
  });

  it('ignores whitespace-only contextNotes', () => {
    const { container } = render(
      <BaseDataSection baseData={makeBaseData({ contextNotes: '   ' })} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('ProfileTypeBadge', () => {
  it('renders "Eigenes Profil" for self', () => {
    render(<ProfileTypeBadge profileType="self" />);
    expect(screen.getByText('Eigenes Profil')).toBeInTheDocument();
  });

  it('renders "Stellvertretend für {name}" for proxy with managedBy', () => {
    render(<ProfileTypeBadge profileType="proxy" managedBy="Asterios" />);
    expect(screen.getByText('Stellvertretend für Asterios')).toBeInTheDocument();
  });

  it('renders "Stellvertreterprofil" for proxy without managedBy', () => {
    render(<ProfileTypeBadge profileType="proxy" />);
    expect(screen.getByText('Stellvertreterprofil')).toBeInTheDocument();
  });
});
