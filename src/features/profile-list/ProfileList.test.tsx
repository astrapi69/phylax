import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileList } from './ProfileList';
import type { Profile } from '../../domain';
import { EMPTY_COUNTS } from '../profile-import/import';

function mkProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p1',
    profileId: 'p1',
    createdAt: 1,
    updatedAt: 1,
    baseData: {
      name: 'Mein Profil',
      weightHistory: [],
      knownDiagnoses: [],
      currentMedications: [],
      relevantLimitations: [],
      profileType: 'self',
    },
    warningSigns: [],
    externalReferences: [],
    version: '1.0',
    ...overrides,
  };
}

describe('ProfileList', () => {
  it('renders each profile as a card with its display name', () => {
    const profiles = [
      mkProfile({ id: 'p1', baseData: { ...mkProfile().baseData, name: 'Asterios' } }),
      mkProfile({
        id: 'p2',
        baseData: {
          ...mkProfile().baseData,
          name: 'Mutter',
          profileType: 'proxy',
          managedBy: 'Asterios',
        },
      }),
    ];
    render(<ProfileList profiles={profiles} onSelect={vi.fn()} />);
    expect(screen.getByText('Asterios')).toBeInTheDocument();
    expect(screen.getByText('Mutter')).toBeInTheDocument();
    expect(screen.getByText('Stellvertretend für Asterios')).toBeInTheDocument();
    expect(screen.getByText('Eigenes Profil')).toBeInTheDocument();
  });

  it('calls onSelect with the profileId when a card button is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ProfileList profiles={[mkProfile({ id: 'target' })]} onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: /auswählen/i }));
    expect(onSelect).toHaveBeenCalledWith('target');
  });

  it('shows "Noch leer" when counts are all zero', () => {
    const p = mkProfile({ id: 'p' });
    render(
      <ProfileList
        profiles={[p]}
        countsByProfile={{ p: { ...EMPTY_COUNTS } }}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Noch leer')).toBeInTheDocument();
  });

  it('shows a compact summary when some counts are non-zero', () => {
    const p = mkProfile({ id: 'p' });
    render(
      <ProfileList
        profiles={[p]}
        countsByProfile={{
          p: {
            ...EMPTY_COUNTS,
            observations: 18,
            labReports: 1,
            labValues: 26,
            supplements: 9,
          },
        }}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/18 Beobachtungen/)).toBeInTheDocument();
    expect(screen.getByText(/1 Laborbefund\b/)).toBeInTheDocument();
    expect(screen.getByText(/9 Supplemente/)).toBeInTheDocument();
  });

  it('marks the selected profile with aria-current', () => {
    const profiles = [mkProfile({ id: 'a' }), mkProfile({ id: 'b' })];
    render(<ProfileList profiles={profiles} onSelect={vi.fn()} selectedProfileId="b" />);
    const cards = screen.getAllByTestId('profile-card');
    expect(cards[0]).not.toHaveAttribute('aria-current');
    expect(cards[1]).toHaveAttribute('aria-current', 'true');
  });

  it('renders the create button when showCreateButton is true', async () => {
    const user = userEvent.setup();
    const onCreateNew = vi.fn();
    render(
      <ProfileList profiles={[]} onSelect={vi.fn()} showCreateButton onCreateNew={onCreateNew} />,
    );
    const btn = screen.getByRole('button', { name: /neues Profil erstellen/i });
    await user.click(btn);
    expect(onCreateNew).toHaveBeenCalledOnce();
  });

  it('uses the custom selectLabel when provided', () => {
    render(
      <ProfileList
        profiles={[mkProfile()]}
        onSelect={vi.fn()}
        selectLabel="Diesem Profil zuordnen"
      />,
    );
    expect(screen.getByRole('button', { name: 'Diesem Profil zuordnen' })).toBeInTheDocument();
  });

  it('renders nothing in the grid when no profiles', () => {
    render(<ProfileList profiles={[]} onSelect={vi.fn()} />);
    expect(screen.queryAllByTestId('profile-card')).toHaveLength(0);
  });
});
