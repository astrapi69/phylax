import { useState } from 'react';
import { PrivacyInfoPopover } from '../../ai-config';

interface CleanupButtonProps {
  onRequestCleanup: () => void;
  disabled?: boolean;
}

/**
 * "KI-Hilfe anfordern" button plus its per-invocation privacy disclosure.
 *
 * The user has already accepted the AI-02 disclaimer, so this is a
 * lightweight reminder at the point of action. The "Datenschutz" link
 * opens the same PrivacyInfoPopover used in the chat header and
 * settings section (I-04).
 */
export function CleanupButton({ onRequestCleanup, disabled = false }: CleanupButtonProps) {
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onRequestCleanup}
        disabled={disabled}
        data-testid="cleanup-request-button"
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-600"
      >
        KI-Hilfe anfordern
      </button>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Die KI bereinigt dein Markdown. Dies sendet deine Eingabe an Anthropic.{' '}
        <button
          type="button"
          onClick={() => setShowPrivacy(true)}
          className="text-blue-700 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Datenschutz
        </button>
      </p>
      <PrivacyInfoPopover open={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </div>
  );
}
