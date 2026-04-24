import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../../i18n/config';
import { ConsentDialog } from './ConsentDialog';

beforeEach(() => {
  if (i18n.language !== 'de') void i18n.changeLanguage('de');
});

describe('ConsentDialog', () => {
  it('renders the pdf-rasterization title and explanation', () => {
    render(<ConsentDialog reason="pdf-rasterization" onGrant={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByText('PDF wird als Bilder hochgeladen')).toBeInTheDocument();
    expect(screen.getByText(/Phylax muss die Seiten als Bilder/)).toBeInTheDocument();
  });

  it('focuses the cancel button on mount', () => {
    render(<ConsentDialog reason="pdf-rasterization" onGrant={vi.fn()} onDecline={vi.fn()} />);
    const cancel = screen.getByRole('button', { name: 'Abbrechen' });
    expect(document.activeElement).toBe(cancel);
  });

  it('calls onGrant with rememberForSession=false by default', async () => {
    const user = userEvent.setup();
    const onGrant = vi.fn();
    render(<ConsentDialog reason="pdf-rasterization" onGrant={onGrant} onDecline={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Verarbeiten' }));
    expect(onGrant).toHaveBeenCalledWith(false);
  });

  it('calls onGrant with rememberForSession=true when checkbox checked', async () => {
    const user = userEvent.setup();
    const onGrant = vi.fn();
    render(<ConsentDialog reason="pdf-rasterization" onGrant={onGrant} onDecline={vi.fn()} />);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Verarbeiten' }));
    expect(onGrant).toHaveBeenCalledWith(true);
  });

  it('calls onDecline when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onDecline = vi.fn();
    render(<ConsentDialog reason="pdf-rasterization" onGrant={vi.fn()} onDecline={onDecline} />);
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onDecline).toHaveBeenCalledOnce();
  });

  it('calls onDecline when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onDecline = vi.fn();
    render(<ConsentDialog reason="pdf-rasterization" onGrant={vi.fn()} onDecline={onDecline} />);
    await user.keyboard('{Escape}');
    expect(onDecline).toHaveBeenCalledOnce();
  });

  it('exposes role=dialog with aria-modal=true', () => {
    render(<ConsentDialog reason="pdf-rasterization" onGrant={vi.fn()} onDecline={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
