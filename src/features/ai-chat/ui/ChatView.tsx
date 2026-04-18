import { useEffect, useRef, useState } from 'react';
import { useChat } from '../useChat';
import type { DetectedFragment } from '../detection';
import { GuidedSessionIndicator } from '../guided';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { CommitPreviewModal } from './CommitPreviewModal';

/**
 * Full-page chat interface for the AI assistant. Messages are ephemeral:
 * React state only, never persisted. Page reload or "Leeren" discards the
 * transcript.
 *
 * The scrolling message list is a polite ARIA live region so screen readers
 * announce new content without interrupting what the user is doing.
 */
export function ChatView() {
  const {
    messages,
    isStreaming,
    isSharingProfile,
    sendMessage,
    cancelStream,
    clearChat,
    shareProfile,
    committedMessageIds,
    markMessageCommitted,
    appendSystemMessage,
    guidedSession,
    startGuidedSession,
    endGuidedSession,
    markGuidedSessionCommit,
  } = useChat();
  const logRef = useRef<HTMLDivElement>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [preview, setPreview] = useState<{
    fragment: DetectedFragment;
    messageId: string;
  } | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const prevStreamingRef = useRef(isStreaming);

  // Auto-scroll to the bottom as new content arrives.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Return focus to the input after streaming ends.
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      setFocusKey((k) => k + 1);
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  async function handleSend(value: string) {
    await sendMessage(value);
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col md:h-[calc(100vh-4rem)]">
      <header className="flex flex-col gap-2 border-b border-gray-200 pb-3 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {guidedSession.active ? 'KI-Assistent - Gefuehrte Sitzung' : 'KI-Assistent'}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {!guidedSession.active && (
              <>
                <button
                  type="button"
                  onClick={() => void shareProfile()}
                  disabled={isStreaming || isSharingProfile}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {isSharingProfile ? 'Lade Profil...' : 'Profil teilen'}
                </button>
                <button
                  type="button"
                  onClick={startGuidedSession}
                  disabled={isStreaming || isSharingProfile}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Gefuehrte Sitzung starten
                </button>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearChat}
                    disabled={isStreaming || isSharingProfile}
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Leeren
                  </button>
                )}
              </>
            )}
            {guidedSession.active && !confirmEnd && (
              <button
                type="button"
                onClick={() => setConfirmEnd(true)}
                disabled={isStreaming || isSharingProfile}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Sitzung beenden
              </button>
            )}
            {guidedSession.active && confirmEnd && (
              <div
                data-testid="guided-session-end-confirm"
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
              >
                <span>Sitzung wirklich beenden?</span>
                <button
                  type="button"
                  onClick={() => {
                    endGuidedSession();
                    setConfirmEnd(false);
                  }}
                  className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Ja, beenden
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmEnd(false)}
                  className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Weiter
                </button>
              </div>
            )}
          </div>
        </div>
        {guidedSession.active && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <GuidedSessionIndicator state={guidedSession} />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void shareProfile()}
                disabled={isStreaming || isSharingProfile}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {isSharingProfile ? 'Lade Profil...' : 'Profil teilen'}
              </button>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  disabled={isStreaming || isSharingProfile}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Leeren
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Chat-Verlauf"
        className="flex-1 overflow-y-auto px-1 py-3"
      >
        {messages.length === 0 ? <WelcomeMessage /> : null}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onCommitPreview={(fragment) => setPreview({ fragment, messageId: m.id })}
            committed={committedMessageIds.has(m.id)}
          />
        ))}
      </div>

      {isStreaming && (
        <div className="flex justify-center py-1">
          <button
            type="button"
            onClick={cancelStream}
            className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Abbrechen
          </button>
        </div>
      )}

      <ChatInput onSend={handleSend} disabled={isStreaming} resetFocusKey={focusKey} />

      {preview && (
        <CommitPreviewModal
          fragment={preview.fragment}
          onClose={() => setPreview(null)}
          onCommitSuccess={(summary) => {
            markMessageCommitted(preview.messageId);
            appendSystemMessage(summary);
          }}
          onCommitted={(diff) => markGuidedSessionCommit(diff)}
        />
      )}
    </div>
  );
}

function WelcomeMessage() {
  return (
    <div className="mx-auto my-6 max-w-lg text-center text-sm text-gray-600 dark:text-gray-400">
      <p className="mb-3 text-base font-medium text-gray-900 dark:text-gray-100">
        Willkommen beim KI-Assistenten.
      </p>
      <p className="mb-4">
        Beschreibe deine Gesundheitsbeobachtungen in eigenen Worten. Ich helfe dir, sie zu
        strukturieren.
      </p>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
        Beispiele
      </p>
      <ul className="space-y-1 text-left">
        <li>&bull; &quot;Ich habe seit drei Wochen Schulterschmerzen links.&quot;</li>
        <li>&bull; &quot;Mein Blutdruck war letzte Woche mehrfach ueber 140/90.&quot;</li>
        <li>&bull; &quot;Ich nehme seit Januar Vitamin D.&quot;</li>
      </ul>
    </div>
  );
}
