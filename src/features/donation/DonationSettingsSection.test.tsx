import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DonationSettingsSection } from './DonationSettingsSection';
import { DONATION_URL } from './constants';

describe('DonationSettingsSection', () => {
  it('renders the "Phylax unterstuetzen" h2 and the description paragraph', () => {
    render(<DonationSettingsSection />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Phylax unterstuetzen' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Open-Source-Projekt/)).toBeInTheDocument();
    expect(screen.getByText(/ohne Werbung/)).toBeInTheDocument();
  });

  it('renders a DonateLink that points at DONATION_URL with safe external-link attributes', () => {
    render(<DonationSettingsSection />);
    const link = screen.getByRole('link', { name: /Projekt unterstuetzen/ });
    expect(link).toHaveAttribute('href', DONATION_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('is addressable via aria-labelledby so nested landmarks stay accessible', () => {
    render(<DonationSettingsSection />);
    const section = screen
      .getByRole('heading', { level: 2, name: 'Phylax unterstuetzen' })
      .closest('section');
    expect(section).toHaveAttribute('aria-labelledby', 'donation-section-heading');
  });
});
