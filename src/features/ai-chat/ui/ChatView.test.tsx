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
    isSharingProfile: false,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    cancelStream: vi.fn(),
    clearChat: vi.fn(),
    shareProfile: vi.fn().mockResolvedValue(undefined),
    committedMessageIds: new Set<string>(),
    markMessageCommitted: vi.fn(),
    appendSystemMessage: vi.fn(),
    guidedSession: { active: false, sectionsCompleted: [], startedAt: null },
    startGuidedSession: vi.fn(),
    endGuidedSession: vi.fn(),
    markGuidedSessionCommit: vi.fn(),
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

  it('"Profil teilen" button is visible on the empty state and calls shareProfile', async () => {
    const mocked = mockUseChat();
    const user = userEvent.setup();
    render(<ChatView />);
    await user.click(screen.getByRole('button', { name: 'Profil teilen' }));
    expect(mocked.shareProfile).toHaveBeenCalledOnce();
  });

  it('"Profil teilen" label swaps to "Lade Profil..." and the button is disabled while sharing', () => {
    mockUseChat({ isSharingProfile: true });
    render(<ChatView />);
    const btn = screen.getByRole('button', { name: 'Lade Profil...' });
    expect(btn).toBeDisabled();
  });

  it('"Profil teilen" is disabled during streaming', () => {
    mockUseChat({
      isStreaming: true,
      messages: [{ id: 'a1', role: 'assistant', content: '', timestamp: 0, streaming: true }],
    });
    render(<ChatView />);
    expect(screen.getByRole('button', { name: 'Profil teilen' })).toBeDisabled();
  });

  it('clicking "In Profil uebernehmen" on an assistant message opens the preview modal', async () => {
    mockUseChat({
      messages: [
        {
          id: 'a1',
          role: 'assistant',
          content: '### Linke Schulter\n- **Status:** Akut\n- **Beobachtung:** Druckschmerz',
          timestamp: 0,
        },
      ],
    });
    const user = userEvent.setup();
    render(<ChatView />);

    await user.click(screen.getByTestId('commit-preview-button'));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'commit-preview-title');

    await user.click(screen.getByRole('button', { name: 'Schliessen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Gefuehrte Sitzung starten" button is visible when no guided session is active', () => {
    mockUseChat();
    render(<ChatView />);
    expect(screen.getByRole('button', { name: 'Gefuehrte Sitzung starten' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sitzung beenden' })).not.toBeInTheDocument();
  });

  it('clicking "Gefuehrte Sitzung starten" calls startGuidedSession', async () => {
    const mocked = mockUseChat();
    const user = userEvent.setup();
    render(<ChatView />);
    await user.click(screen.getByRole('button', { name: 'Gefuehrte Sitzung starten' }));
    expect(mocked.startGuidedSession).toHaveBeenCalledOnce();
  });

  it('header shows the guided label and the progress indicator when a session is active', () => {
    mockUseChat({
      guidedSession: {
        active: true,
        sectionsCompleted: ['observations'],
        startedAt: 1,
      },
    });
    render(<ChatView />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'KI-Assistent - Gefuehrte Sitzung' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('guided-session-indicator')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sitzung beenden' })).toBeInTheDocument();
  });

  it('"Sitzung beenden" requires confirmation before calling endGuidedSession', async () => {
    const mocked = mockUseChat({
      guidedSession: { active: true, sectionsCompleted: [], startedAt: 1 },
    });
    const user = userEvent.setup();
    render(<ChatView />);

    await user.click(screen.getByRole('button', { name: 'Sitzung beenden' }));
    expect(screen.getByTestId('guided-session-end-confirm')).toBeInTheDocument();
    expect(mocked.endGuidedSession).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Ja, beenden' }));
    expect(mocked.endGuidedSession).toHaveBeenCalledOnce();
  });

  it('privacy info icon is present in the header and opens the popover when clicked', async () => {
    mockUseChat();
    const user = userEvent.setup();
    render(<ChatView />);

    const iconBtn = screen.getByTestId('chat-privacy-info-button');
    expect(iconBtn).toHaveAttribute('aria-label', 'Datenschutz-Informationen anzeigen');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(iconBtn);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'privacy-info-title');
    expect(screen.getByText(/30 Tage zur Sicherheitspruefung/)).toBeInTheDocument();
  });

  it('committed assistant messages show the "In Profil uebernommen" badge instead of the button', () => {
    mockUseChat({
      messages: [
        {
          id: 'a1',
          role: 'assistant',
          content: '### Linke Schulter\n- **Status:** Akut\n- **Beobachtung:** Druckschmerz',
          timestamp: 0,
        },
      ],
      committedMessageIds: new Set<string>(['a1']),
    });
    render(<ChatView />);

    expect(screen.getByTestId('commit-preview-committed-badge')).toHaveTextContent(
      'In Profil uebernommen',
    );
    expect(screen.queryByTestId('commit-preview-button')).not.toBeInTheDocument();
  });
});
