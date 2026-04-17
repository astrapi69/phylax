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
  'Import',
  'Einstellungen',
];

describe('NavBar', () => {
  it('shows all expected navigation items', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>,
    );

    for (const label of EXPECTED_ITEMS) {
      // Each item appears twice: mobile (bottom) + desktop (side)
      const links = screen.getAllByText(label);
      expect(links.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('active route item has highlight class', () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <NavBar />
      </MemoryRouter>,
    );

    // Find the desktop nav links (they have the full text)
    const activeLinks = screen.getAllByText('Profil');
    const hasActiveClass = activeLinks.some((link) =>
      link.closest('a')?.className.includes('text-blue-700'),
    );
    expect(hasActiveClass).toBe(true);
  });

  it('all items are keyboard-reachable links', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>,
    );

    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    const links = nav.querySelectorAll('a');
    // 6 items x 2 (mobile + desktop) = 12 links
    expect(links.length).toBe(EXPECTED_ITEMS.length * 2);
  });
});
