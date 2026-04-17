import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from '../useChat';

function userMsg(content: string): ChatMessage {
  return { id: 'u1', role: 'user', content, timestamp: 0 };
}

function assistantMsg(content: string, streaming = false): ChatMessage {
  return { id: 'a1', role: 'assistant', content, timestamp: 0, streaming };
}

function systemMsg(content: string): ChatMessage {
  return { id: 's1', role: 'system', content, timestamp: 0 };
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
    expect(bubble.parentElement).toHaveClass('justify-start');
    // The KI label is present and exposes the full name via aria-label
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
});
