import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CleanupButton } from './CleanupButton';

describe('CleanupButton', () => {
  it('renders with the expected label and privacy disclosure', () => {
    render(<CleanupButton onRequestCleanup={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'KI-Hilfe anfordern' })).toBeInTheDocument();
    expect(screen.getByText(/sendet deine Eingabe an Anthropic/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Datenschutz' })).toBeInTheDocument();
  });

  it('triggers onRequestCleanup when clicked', async () => {
    const onRequestCleanup = vi.fn();
    const user = userEvent.setup();
    render(<CleanupButton onRequestCleanup={onRequestCleanup} />);
    await user.click(screen.getByRole('button', { name: 'KI-Hilfe anfordern' }));
    expect(onRequestCleanup).toHaveBeenCalledOnce();
  });

  it('is disabled when the disabled prop is true', () => {
    render(<CleanupButton onRequestCleanup={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'KI-Hilfe anfordern' })).toBeDisabled();
  });

  it('opens the privacy info popover when the Datenschutz link is clicked', async () => {
    const user = userEvent.setup();
    render(<CleanupButton onRequestCleanup={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Datenschutz' }));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'privacy-info-title');
  });
});
