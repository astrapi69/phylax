import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NavBar } from './NavBar';

const EXPECTED_ITEMS = [
  'Profil',
  'Beobachtungen',
  'Laborwerte',
  'Supplemente',
  'Offene Punkte',
  'Verlauf',
  'Dokumente',
  'KI-Assistent',
  'Import',
  'Einstellungen',
];

describe('NavBar (desktop side panel)', () => {
  it('shows all expected navigation items exactly once', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>,
    );

    // BUG-02: NavBar renders only the desktop side panel; mobile
    // moved to NavDrawer. Each item must appear exactly once.
    for (const label of EXPECTED_ITEMS) {
      const links = screen.getAllByText(label);
      expect(links).toHaveLength(1);
    }
  });

  it('active route item has highlight class', () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <NavBar />
      </MemoryRouter>,
    );

    const link = screen.getByText('Profil').closest('a');
    expect(link?.className).toContain('text-blue-700');
  });

  it('all items are keyboard-reachable links', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>,
    );

    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    const links = nav.querySelectorAll('a');
    expect(links).toHaveLength(EXPECTED_ITEMS.length);
  });
});
