import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatMessage, UseChatResult } from '../useChat';
import * as useChatModule from '../useChat';
import { ChatView } from './ChatView';

function mockUseChat(overrides: Partial<UseChatResult> = {}): UseChatResult {
  const base: UseChatResult = {
    messages: [],
    isStreaming: false,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    cancelStream: vi.fn(),
    clearChat: vi.fn(),
  };
  const mocked = { ...base, ...overrides };
  vi.spyOn(useChatModule, 'useChat').mockReturnValue(mocked);
  return mocked;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChatView', () => {
  it('renders the welcome message when no messages exist', () => {
    mockUseChat();
    render(<ChatView />);
    expect(screen.getByRole('heading', { level: 1, name: 'KI-Assistent' })).toBeInTheDocument();
    expect(screen.getByText(/Willkommen beim KI-Assistenten/)).toBeInTheDocument();
    expect(screen.getByText(/Beschreibe deine Gesundheitsbeobachtungen/)).toBeInTheDocument();
  });

  it('does not render the Leeren button when there are no messages', () => {
    mockUseChat();
    render(<ChatView />);
    expect(screen.queryByRole('button', { name: 'Leeren' })).not.toBeInTheDocument();
  });

  it('renders user and assistant messages with the KI label', () => {
    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'Ich habe Schulterschmerzen.', timestamp: 0 },
      { id: 'a1', role: 'assistant', content: 'Danke fuer die Information.', timestamp: 1 },
    ];
    mockUseChat({ messages });
    render(<ChatView />);
    expect(screen.getByTestId('message-bubble-user')).toHaveTextContent(
      'Ich habe Schulterschmerzen.',
    );
    expect(screen.getByTestId('message-bubble-assistant')).toHaveTextContent(
      'Danke fuer die Information.',
    );
    expect(screen.getByLabelText('KI-Assistent')).toBeInTheDocument();
  });

  it('disables the input while streaming and renders the Abbrechen button', () => {
    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'hi', timestamp: 0 },
      { id: 'a1', role: 'assistant', content: 'partial', timestamp: 1, streaming: true },
    ];
    mockUseChat({ messages, isStreaming: true });
    render(<ChatView />);

    expect(screen.getByLabelText('Nachricht an den KI-Assistenten')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Senden' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
  });

  it('does not render the Abbrechen button when not streaming', () => {
    mockUseChat({
      messages: [{ id: 'a1', role: 'assistant', content: 'done', timestamp: 0 }],
      isStreaming: false,
    });
    render(<ChatView />);
    expect(screen.queryByRole('button', { name: 'Abbrechen' })).not.toBeInTheDocument();
  });

  it('"Leeren" calls clearChat', async () => {
    const mocked = mockUseChat({
      messages: [{ id: 'u1', role: 'user', content: 'hi', timestamp: 0 }],
    });
    const user = userEvent.setup();
    render(<ChatView />);
    await user.click(screen.getByRole('button', { name: 'Leeren' }));
    expect(mocked.clearChat).toHaveBeenCalledOnce();
  });

  it('"Abbrechen" calls cancelStream', async () => {
    const mocked = mockUseChat({
      messages: [{ id: 'a1', role: 'assistant', content: '', timestamp: 0, streaming: true }],
      isStreaming: true,
    });
    const user = userEvent.setup();
    render(<ChatView />);
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(mocked.cancelStream).toHaveBeenCalledOnce();
  });

  it('submitting the input calls sendMessage with the trimmed value', async () => {
    const mocked = mockUseChat();
    const user = userEvent.setup();
    render(<ChatView />);
    await user.type(screen.getByLabelText('Nachricht an den KI-Assistenten'), 'Hallo{Enter}');
    expect(mocked.sendMessage).toHaveBeenCalledWith('Hallo');
  });

  it('exposes the message list as an aria-live polite log region', () => {
    mockUseChat();
    render(<ChatView />);
    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).toHaveAttribute('aria-label', 'Chat-Verlauf');
  });

  it('renders system error messages with centered warning styling', () => {
    mockUseChat({
      messages: [
        {
          id: 's1',
          role: 'system',
          content: 'API-Schluessel ungueltig. Bitte pruefen unter Einstellungen.',
          timestamp: 0,
          errorKind: 'auth',
        },
      ],
    });
    render(<ChatView />);
    expect(screen.getByTestId('message-bubble-system')).toHaveTextContent(
      /API-Schluessel ungueltig/,
    );
  });
});
