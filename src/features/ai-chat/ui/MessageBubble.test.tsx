import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from '../useChat';
import type { ProfileShareCounts } from '../profileSummary';

function userMsg(content: string): ChatMessage {
  return { id: 'u1', role: 'user', content, timestamp: 0 };
}

function assistantMsg(content: string, streaming = false): ChatMessage {
  return { id: 'a1', role: 'assistant', content, timestamp: 0, streaming };
}

function systemMsg(content: string): ChatMessage {
  return { id: 's1', role: 'system', content, timestamp: 0 };
}

function contextMsg(content: string, counts?: ProfileShareCounts): ChatMessage {
  return { id: 'c1', role: 'context', content, timestamp: 0, contextCounts: counts };
}

describe('MessageBubble', () => {
  it('renders a user message right-aligned with its content', () => {
    render(<MessageBubble message={userMsg('Hallo, KI.')} />);
    const bubble = screen.getByTestId('message-bubble-user');
    expect(bubble).toHaveTextContent('Hallo, KI.');
    // Parent flex container uses justify-end for right alignment
    expect(bubble.parentElement).toHaveClass('justify-end');
  });

  it('renders an assistant message with the "KI" label and left alignment', () => {
    render(<MessageBubble message={assistantMsg('Strukturierte Antwort.')} />);
    const bubble = screen.getByTestId('message-bubble-assistant');
    // The assistant bubble's wrapper is a left-aligned column so the
    // "In Profil uebernehmen" action can sit directly under the bubble.
    expect(bubble.parentElement).toHaveClass('items-start');
    const label = screen.getByLabelText('KI-Assistent');
    expect(label).toHaveTextContent('KI');
    expect(bubble).toHaveTextContent('Strukturierte Antwort.');
  });

  it('renders an assistant message as Markdown (lists, emphasis)', () => {
    render(
      <MessageBubble
        message={assistantMsg('- **Fakt:** Schmerzen seit drei Wochen\n- **Muster:** morgens')}
      />,
    );
    expect(screen.getByRole('list')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Fakt:');
  });

  it('shows the streaming indicator when the assistant message is streaming', () => {
    render(<MessageBubble message={assistantMsg('partial', true)} />);
    expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument();
  });

  it('renders an empty streaming assistant message with only the indicator', () => {
    render(<MessageBubble message={assistantMsg('', true)} />);
    // No markdown body, but indicator is present
    expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument();
    // The KI label still renders for clarity
    expect(screen.getByLabelText('KI-Assistent')).toBeInTheDocument();
  });

  it('renders a system message centered with warning styling', () => {
    render(<MessageBubble message={systemMsg('API-Schluessel ungueltig.')} />);
    const bubble = screen.getByTestId('message-bubble-system');
    expect(bubble).toHaveTextContent('API-Schluessel ungueltig.');
    expect(bubble).toHaveClass('text-center');
  });

  it('renders a context message as a collapsed card with counts and hides the body by default', () => {
    const counts: ProfileShareCounts = {
      observationCount: 18,
      abnormalLabCount: 8,
      supplementCount: 9,
      openPointCount: 5,
      warningSignCount: 2,
    };
    render(<MessageBubble message={contextMsg('# Profil: Max\n\n## Basisdaten', counts)} />);

    const card = screen.getByTestId('message-bubble-context');
    expect(card).toHaveTextContent('Profil geteilt');
    expect(card).toHaveTextContent(
      /18 Beobachtungen, 8 abweichende Laborwerte, 9 Supplemente, 5 offene Punkte, 2 Warnsignale/,
    );
    // Body is collapsed by default
    expect(screen.queryByTestId('message-bubble-context-details')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Details anzeigen' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('context card "Details anzeigen" reveals the Markdown body', async () => {
    const user = userEvent.setup();
    render(
      <MessageBubble
        message={contextMsg('# Profil: Max\n\n- Alter: 56 Jahre', {
          observationCount: 0,
          abnormalLabCount: 0,
          supplementCount: 0,
          openPointCount: 0,
          warningSignCount: 0,
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Details anzeigen' }));

    expect(screen.getByTestId('message-bubble-context-details')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Profil: Max' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ausblenden' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('shows "In Profil uebernehmen" on an assistant message when a fragment is detected', async () => {
    const onCommitPreview = vi.fn();
    const user = userEvent.setup();
    const msg: ChatMessage = assistantMsg(
      '### Linke Schulter\n- **Status:** Akut\n- **Beobachtung:** Druckschmerz',
    );
    render(<MessageBubble message={msg} onCommitPreview={onCommitPreview} />);

    const btn = screen.getByTestId('commit-preview-button');
    expect(btn).toHaveTextContent('In Profil uebernehmen');

    await user.click(btn);
    expect(onCommitPreview).toHaveBeenCalledOnce();
    const fragment = onCommitPreview.mock.calls[0]?.[0];
    expect(fragment.hasObservations).toBe(true);
  });

  it('hides "In Profil uebernehmen" when the assistant message has no fragment', () => {
    const msg = assistantMsg('Das war eine reine Rueckfrage - kein Block hier.');
    render(<MessageBubble message={msg} onCommitPreview={vi.fn()} />);
    expect(screen.queryByTestId('commit-preview-button')).not.toBeInTheDocument();
  });

  it('hides "In Profil uebernehmen" while the assistant message is streaming', () => {
    const msg = assistantMsg(
      '### Linke Schulter\n- **Status:** Akut\n- **Beobachtung:** Druckschmerz',
      true,
    );
    render(<MessageBubble message={msg} onCommitPreview={vi.fn()} />);
    expect(screen.queryByTestId('commit-preview-button')).not.toBeInTheDocument();
  });

  it('does not render the button for user, system, or context messages', () => {
    const obsFragment = '### Linke Schulter\n- **Status:** Akut\n- **Beobachtung:** Druckschmerz';
    const { rerender } = render(
      <MessageBubble message={userMsg(obsFragment)} onCommitPreview={vi.fn()} />,
    );
    expect(screen.queryByTestId('commit-preview-button')).not.toBeInTheDocument();

    rerender(<MessageBubble message={systemMsg(obsFragment)} onCommitPreview={vi.fn()} />);
    expect(screen.queryByTestId('commit-preview-button')).not.toBeInTheDocument();

    rerender(<MessageBubble message={contextMsg(obsFragment)} onCommitPreview={vi.fn()} />);
    expect(screen.queryByTestId('commit-preview-button')).not.toBeInTheDocument();
  });

  it('context card falls back to "keine Inhalte" when every count is zero', () => {
    render(
      <MessageBubble
        message={contextMsg('# Profil', {
          observationCount: 0,
          abnormalLabCount: 0,
          supplementCount: 0,
          openPointCount: 0,
          warningSignCount: 0,
        })}
      />,
    );
    expect(screen.getByTestId('message-bubble-context')).toHaveTextContent('keine Inhalte');
  });
});
