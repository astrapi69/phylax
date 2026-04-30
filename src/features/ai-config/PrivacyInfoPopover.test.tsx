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
    // TD-12 migration: aria-labelledby points to the auto-generated
    // ModalHeader id; resolve via document.getElementById and verify
    // the referenced heading carries the dialog title text.
    render(<PrivacyInfoPopover open={true} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    const labelledby = dialog.getAttribute('aria-labelledby');
    if (!labelledby) throw new Error('aria-labelledby missing on dialog');
    const heading = document.getElementById(labelledby);
    expect(heading?.textContent).toMatch(/Datenschutz beim KI-Chat/i);
    expect(screen.getByRole('heading', { name: 'Datenschutz beim KI-Chat' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Was Phylax macht' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Was Anthropic macht' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Was du kontrollierst' })).toBeInTheDocument();
  });

  it('focuses the Schließen button on open', () => {
    render(<PrivacyInfoPopover open={true} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Schließen' })).toHaveFocus();
  });

  it('Schließen button calls onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PrivacyInfoPopover open={true} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Schließen' }));
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
    // TD-12 migration: O-20 Modal renders the backdrop as a separate
    // div around the role="dialog" panel. Click the backdrop directly
    // via its data-testid (Modal exposes `${testId}-backdrop` when
    // `testId` is supplied) instead of clicking the dialog panel
    // (which under the new structure would not bubble to the
    // backdrop-close handler because of the `e.target === e.currentTarget`
    // guard).
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PrivacyInfoPopover open={true} onClose={onClose} />);
    await user.click(screen.getByTestId('privacy-info-popover-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
