import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LegalSection } from './LegalSection';

describe('LegalSection', () => {
  it('renders heading + privacy + license links', () => {
    render(
      <MemoryRouter>
        <LegalSection />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Rechtliches' })).toBeInTheDocument();
    const privacyLink = screen.getByTestId('legal-link-privacy');
    expect(privacyLink).toHaveAttribute('href', '/privacy');
    const licenseLink = screen.getByTestId('legal-link-license');
    expect(licenseLink).toHaveAttribute('href', '/license');
  });
});
