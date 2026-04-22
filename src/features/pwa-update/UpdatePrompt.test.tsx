import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpdatePrompt } from './UpdatePrompt';

describe('UpdatePrompt', () => {
  it('does not render when needRefresh is false', () => {
    const { container } = render(
      <UpdatePrompt needRefresh={false} onUpdate={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders message when needRefresh is true', () => {
    render(<UpdatePrompt needRefresh={true} onUpdate={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Eine neue Version ist verfügbar.')).toBeInTheDocument();
  });

  it('calls onUpdate when update button clicked', async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<UpdatePrompt needRefresh={true} onUpdate={onUpdate} onDismiss={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Jetzt aktualisieren' }));
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when dismiss button clicked', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<UpdatePrompt needRefresh={true} onUpdate={vi.fn()} onDismiss={onDismiss} />);

    await user.click(screen.getByRole('button', { name: 'Später' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
