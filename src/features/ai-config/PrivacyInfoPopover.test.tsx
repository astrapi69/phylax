import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrivacyInfoPopover } from './PrivacyInfoPopover';

describe('PrivacyInfoPopover', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<PrivacyInfoPopover open={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the privacy info content when open', () => {
    render(<PrivacyInfoPopover open={true} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'privacy-info-title');
    expect(screen.getByRole('heading', { name: 'Datenschutz beim KI-Chat' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Was Phylax macht' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Was Anthropic macht' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Was du kontrollierst' })).toBeInTheDocument();
  });

  it('focuses the Schliessen button on open', () => {
    render(<PrivacyInfoPopover open={true} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Schliessen' })).toHaveFocus();
  });

  it('Schliessen button calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PrivacyInfoPopover open={true} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Schliessen' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Escape key calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PrivacyInfoPopover open={true} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('clicking the backdrop calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PrivacyInfoPopover open={true} onClose={onClose} />);
    await user.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
