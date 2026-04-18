import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DonateLink } from './DonateLink';
import { DONATION_URL } from './constants';

describe('DonateLink', () => {
  it('renders children as the visible label', () => {
    render(<DonateLink>Projekt unterstuetzen</DonateLink>);
    expect(screen.getByRole('link', { name: /Projekt unterstuetzen/ })).toBeInTheDocument();
  });

  it('points at DONATION_URL and opens in a new tab with a safe rel', () => {
    render(<DonateLink>Support</DonateLink>);
    const link = screen.getByRole('link', { name: /Support/ });
    expect(link).toHaveAttribute('href', DONATION_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('fires onBeforeNavigate on click before the browser follows the link', async () => {
    const user = userEvent.setup();
    const onBeforeNavigate = vi.fn();
    render(<DonateLink onBeforeNavigate={onBeforeNavigate}>Support</DonateLink>);
    await user.click(screen.getByRole('link', { name: /Support/ }));
    expect(onBeforeNavigate).toHaveBeenCalledOnce();
  });

  it('exposes a screen-reader-only "neuer Tab" hint', () => {
    render(<DonateLink>Support</DonateLink>);
    expect(screen.getByText(/oeffnet in neuem Tab/)).toBeInTheDocument();
  });
});
