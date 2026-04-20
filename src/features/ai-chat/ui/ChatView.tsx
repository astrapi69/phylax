import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChat } from '../useChat';
import type { DetectedFragment } from '../detection';
import { GuidedSessionIndicator } from '../guided';
import { PrivacyInfoPopover } from '../../ai-config';
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
  const { t } = useTranslation('ai-chat');
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
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);
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
            {guidedSession.active ? t('heading.guided') : t('common:entity.ai-assistant')}
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
                  {isSharingProfile ? t('header.share-profile-loading') : t('header.share-profile')}
                </button>
                <button
                  type="button"
                  onClick={startGuidedSession}
                  disabled={isStreaming || isSharingProfile}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {t('header.start-guided')}
                </button>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearChat}
                    disabled={isStreaming || isSharingProfile}
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    {t('header.clear')}
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
                {t('header.end-session')}
              </button>
            )}
            {guidedSession.active && confirmEnd && (
              <div
                data-testid="guided-session-end-confirm"
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
              >
                <span>{t('header.confirm-end')}</span>
                <button
                  type="button"
                  onClick={() => {
                    endGuidedSession();
                    setConfirmEnd(false);
                  }}
                  className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {t('header.confirm-end-yes')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmEnd(false)}
                  className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {t('header.confirm-end-no')}
                </button>
              </div>
            )}
            <PrivacyInfoButton onOpen={() => setShowPrivacyInfo(true)} />
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
                {isSharingProfile ? t('header.share-profile-loading') : t('header.share-profile')}
              </button>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearChat}
                  disabled={isStreaming || isSharingProfile}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {t('header.clear')}
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
        aria-label={t('header.log-aria-label')}
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
            {t('common:action.cancel')}
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

      <PrivacyInfoPopover open={showPrivacyInfo} onClose={() => setShowPrivacyInfo(false)} />
    </div>
  );
}

function PrivacyInfoButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation('ai-chat');
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t('header.privacy-info-label')}
      data-testid="chat-privacy-info-button"
      className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-300 text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="10" cy="10" r="8" />
        <path d="M10 9v5" />
        <circle cx="10" cy="6.5" r="0.5" fill="currentColor" />
      </svg>
    </button>
  );
}

function WelcomeMessage() {
  const { t } = useTranslation('ai-chat');
  return (
    <div className="mx-auto my-6 max-w-lg text-center text-sm text-gray-600 dark:text-gray-400">
      <p className="mb-3 text-base font-medium text-gray-900 dark:text-gray-100">
        {t('welcome.title')}
      </p>
      <p className="mb-4">{t('welcome.intro')}</p>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
        {t('welcome.examples-title')}
      </p>
      <ul className="space-y-1 text-left">
        <li>&bull; {t('welcome.example-1')}</li>
        <li>&bull; {t('welcome.example-2')}</li>
        <li>&bull; {t('welcome.example-3')}</li>
      </ul>
    </div>
  );
}
