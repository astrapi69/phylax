import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NavBar } from './NavBar';
import { useAIConfig } from '../ai-config';

// BUG-07: NavBar filters /chat out when AI is not configured.
// Mock useAIConfig and toggle status per test.
vi.mock('../ai-config', () => ({
  useAIConfig: vi.fn(),
}));

const useAIConfigMock = vi.mocked(useAIConfig);

function setAiStatus(status: 'configured' | 'unconfigured' | 'loading' | 'error') {
  useAIConfigMock.mockReturnValue({
    state: { status },
    // Other hook surface area is not consumed by NavBar; cast away.
  } as unknown as ReturnType<typeof useAIConfig>);
}

beforeEach(() => {
  setAiStatus('configured');
});

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
  it('shows all expected navigation items exactly once when AI configured', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>,
    );

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

  it('hides KI-Assistent link when AI is unconfigured (BUG-07)', () => {
    setAiStatus('unconfigured');
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>,
    );

    expect(screen.queryByText('KI-Assistent')).toBeNull();
    expect(screen.getByText('Profil')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    expect(nav.querySelectorAll('a')).toHaveLength(EXPECTED_ITEMS.length - 1);
  });
});
