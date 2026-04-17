import type { ChatMessage } from '../useChat';
import { MarkdownContent } from '../../profile-view/MarkdownContent';
import { StreamingIndicator } from './StreamingIndicator';

interface MessageBubbleProps {
  message: ChatMessage;
}

/**
 * Single message in the chat transcript. Three visual variants:
 *
 * - user: right-aligned, primary-color bubble, plain text (whitespace-pre-line)
 * - assistant: left-aligned, neutral bubble, rendered as Markdown, prefixed
 *   with a visible "KI" label so users always know which messages came from
 *   the AI (required by AI-05)
 * - system: centered, amber/red accent, no bubble shape - used for error and
 *   configuration messages produced locally by the hook
 *
 * While an assistant message is streaming, the indicator is appended inside
 * the bubble and the content may be empty on first paint.
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === 'system') {
    return (
      <div
        data-testid="message-bubble-system"
        className="my-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      >
        {message.content}
      </div>
    );
  }

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          data-testid="message-bubble-user"
          className="my-1 max-w-[85%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2 text-sm text-white"
        >
          <p className="whitespace-pre-line">{message.content}</p>
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className="flex justify-start">
      <div
        data-testid="message-bubble-assistant"
        className="my-1 max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"
      >
        <span
          aria-label="KI-Assistent"
          className="mb-1 inline-block rounded bg-gray-300 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-700 dark:text-gray-200"
        >
          KI
        </span>
        {message.content.length > 0 && <MarkdownContent>{message.content}</MarkdownContent>}
        {message.streaming && (
          <span className="ml-1 align-middle">
            <StreamingIndicator />
          </span>
        )}
      </div>
    </div>
  );
}
