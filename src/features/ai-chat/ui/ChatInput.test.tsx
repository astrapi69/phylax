import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  it('renders a labeled textarea and a Senden button', () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} />);
    expect(screen.getByLabelText('Nachricht an den KI-Assistenten')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Senden' })).toBeInTheDocument();
  });

  it('Enter sends the trimmed message; Shift+Enter inserts a newline', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);

    const textarea = screen.getByLabelText('Nachricht an den KI-Assistenten');
    await user.type(textarea, 'Hallo{Shift>}{Enter}{/Shift}Welt');
    expect(onSend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('Hallo\nWelt');

    await user.keyboard('{Enter}');
    expect(onSend).toHaveBeenCalledOnce();
    expect(onSend).toHaveBeenCalledWith('Hallo\nWelt');
  });

  it('disables the button and the textarea when disabled=true', () => {
    render(<ChatInput onSend={vi.fn()} disabled={true} />);
    expect(screen.getByRole('button', { name: 'Senden' })).toBeDisabled();
    expect(screen.getByLabelText('Nachricht an den KI-Assistenten')).toBeDisabled();
  });

  it('clears the textarea after a successful send', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSend={vi.fn()} disabled={false} />);
    const textarea = screen.getByLabelText('Nachricht an den KI-Assistenten');
    await user.type(textarea, 'one{Enter}');
    expect(textarea).toHaveValue('');
  });

  it('ignores whitespace-only submissions', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByLabelText('Nachricht an den KI-Assistenten');
    await user.type(textarea, '   ');
    await user.click(screen.getByRole('button', { name: 'Senden' }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('auto-focuses the textarea on mount', () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} />);
    expect(screen.getByLabelText('Nachricht an den KI-Assistenten')).toHaveFocus();
  });
});
