import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DonationOnboardingCard } from './DonationOnboardingCard';
import { readDonationState } from './donationStorage';
import { DONATION_URL } from './constants';

beforeEach(() => {
  window.localStorage.clear();
});

describe('DonationOnboardingCard', () => {
  it('renders the welcome heading, description, both buttons, and the settings hint', () => {
    render(<DonationOnboardingCard onDismiss={vi.fn()} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Willkommen bei Phylax' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Open-Source-Projekt eines einzelnen Entwicklers/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Projekt unterstützen/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verstanden' })).toBeInTheDocument();
    expect(
      screen.getByText(/Du findest diesen Hinweis jederzeit in den Einstellungen/),
    ).toBeInTheDocument();
  });

  it('"Verstanden" flips onboardingSeen in storage and calls onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<DonationOnboardingCard onDismiss={onDismiss} />);

    expect(readDonationState().onboardingSeen).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Verstanden' }));

    expect(readDonationState().onboardingSeen).toBe(true);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('"Projekt unterstützen" flips onboardingSeen BEFORE onDismiss (synchronous order preserved)', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const onDismiss = vi.fn(() => {
      order.push('onDismiss');
      // At this point the storage flip must have already happened.
      if (readDonationState().onboardingSeen) {
        order.push('storage-was-flipped-before-onDismiss');
      }
    });
    render(<DonationOnboardingCard onDismiss={onDismiss} />);

    await user.click(screen.getByRole('link', { name: /Projekt unterstützen/ }));

    expect(readDonationState().onboardingSeen).toBe(true);
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(order).toEqual(['onDismiss', 'storage-was-flipped-before-onDismiss']);
  });

  it('DonateLink points at DONATION_URL with safe external-link attributes', () => {
    render(<DonationOnboardingCard onDismiss={vi.fn()} />);
    const link = screen.getByRole('link', { name: /Projekt unterstützen/ });
    expect(link).toHaveAttribute('href', DONATION_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('both actions are keyboard-reachable', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<DonationOnboardingCard onDismiss={onDismiss} />);

    await user.tab();
    expect(screen.getByRole('link', { name: /Projekt unterstützen/ })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Verstanden' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
