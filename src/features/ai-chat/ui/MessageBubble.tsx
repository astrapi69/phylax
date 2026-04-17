import { useState } from 'react';
import type { ChatMessage } from '../useChat';
import type { ProfileShareCounts } from '../profileSummary';
import { MarkdownContent } from '../../profile-view/MarkdownContent';
import { StreamingIndicator } from './StreamingIndicator';

interface MessageBubbleProps {
  message: ChatMessage;
}

/**
 * Single message in the chat transcript. Four visual variants:
 *
 * - user: right-aligned, primary-color bubble, plain text (whitespace-pre-line)
 * - assistant: left-aligned, neutral bubble, rendered as Markdown, prefixed
 *   with a visible "KI" label so users always know which messages came from
 *   the AI (required by AI-05)
 * - system: centered, amber/red accent, no bubble shape - used for error and
 *   configuration messages produced locally by the hook
 * - context: a compact collapsible card summarizing a shared profile
 *   (counts only by default). Expanding reveals the full Markdown digest
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

  if (message.role === 'context') {
    return <ContextCard content={message.content} counts={message.contextCounts} />;
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

interface ContextCardProps {
  content: string;
  counts?: ProfileShareCounts;
}

/**
 * Collapsed preview for a shared profile context. The AI sees the full
 * Markdown body in the conversation; the UI hides it by default because
 * a ~3000-token profile dump would make the chat unreadable.
 */
function ContextCard({ content, counts }: ContextCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      data-testid="message-bubble-context"
      className="my-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <span className="mr-2 inline-block rounded bg-blue-200 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Profil geteilt
          </span>
          <span className="text-xs text-blue-900/80 dark:text-blue-100/80">
            {formatCountsLine(counts)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="rounded border border-blue-300 px-2 py-0.5 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:text-blue-200 dark:hover:bg-blue-900"
        >
          {expanded ? 'Ausblenden' : 'Details anzeigen'}
        </button>
      </div>
      {expanded && (
        <div
          data-testid="message-bubble-context-details"
          className="mt-3 border-t border-blue-200 pt-3 dark:border-blue-900"
        >
          <MarkdownContent>{content}</MarkdownContent>
        </div>
      )}
    </div>
  );
}

function formatCountsLine(counts?: ProfileShareCounts): string {
  if (!counts) return '';
  const parts: string[] = [];
  if (counts.observationCount > 0) parts.push(`${counts.observationCount} Beobachtungen`);
  if (counts.abnormalLabCount > 0) {
    parts.push(`${counts.abnormalLabCount} abweichende Laborwerte`);
  }
  if (counts.supplementCount > 0) parts.push(`${counts.supplementCount} Supplemente`);
  if (counts.openPointCount > 0) parts.push(`${counts.openPointCount} offene Punkte`);
  if (counts.warningSignCount > 0) parts.push(`${counts.warningSignCount} Warnsignale`);
  return parts.length > 0 ? parts.join(', ') : 'keine Inhalte';
}
