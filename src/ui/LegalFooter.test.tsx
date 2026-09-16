import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LegalFooter } from './LegalFooter';

describe('LegalFooter', () => {
  it('links to /impressum and /datenschutz', () => {
    render(
      <MemoryRouter>
        <LegalFooter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/impressum');
    expect(screen.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute(
      'href',
      '/datenschutz',
    );
  });

  it('renders as a labeled nav landmark inside a footer element', () => {
    render(
      <MemoryRouter>
        <LegalFooter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Rechtliches' })).toBeInTheDocument();
  });
});
