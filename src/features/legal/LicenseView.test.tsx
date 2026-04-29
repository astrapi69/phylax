import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LicenseView } from './LicenseView';

describe('LicenseView', () => {
  it('renders the heading and intro paragraph', () => {
    render(
      <MemoryRouter>
        <LicenseView />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Lizenz' })).toBeInTheDocument();
    expect(screen.getByText(/MIT-Lizenz/)).toBeInTheDocument();
  });

  it('renders the verbatim MIT license text', () => {
    render(
      <MemoryRouter>
        <LicenseView />
      </MemoryRouter>,
    );
    const block = screen.getByTestId('license-text');
    expect(block.textContent).toContain('MIT License');
    expect(block.textContent).toContain('Asterios Raptis');
    expect(block.textContent).toContain('Permission is hereby granted');
    expect(block.textContent).toContain('AS IS');
  });

  it('renders a back-to-settings link', () => {
    render(
      <MemoryRouter>
        <LicenseView />
      </MemoryRouter>,
    );
    const link = screen.getByText('Zurück zu den Einstellungen');
    expect(link.closest('a')).toHaveAttribute('href', '/settings');
  });
});
