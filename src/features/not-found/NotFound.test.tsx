import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFound } from './NotFound';

describe('NotFound', () => {
  it('renders heading, message, and back-to-profile link', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Seite nicht gefunden');
    expect(screen.getByText('Die angeforderte Seite existiert nicht.')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: 'Zurück zum Profil' });
    expect(link).toHaveAttribute('href', '/profile');
  });
});
