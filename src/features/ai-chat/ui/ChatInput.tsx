import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (value: string) => void;
  disabled: boolean;
  /** Focus the input after this flips from true to false. */
  resetFocusKey?: number;
}

/**
 * Multi-line textarea plus Senden button.
 *
 * Keyboard: Enter sends, Shift+Enter inserts a newline. This matches the
 * convention of most chat UIs. The textarea grows up to a few lines before
 * scrolling internally.
 *
 * Focus is claimed on mount and whenever `resetFocusKey` changes, which the
 * parent increments when a response finishes so the user can keep typing
 * without reaching for the mouse.
 */
export function ChatInput({ onSend, disabled, resetFocusKey }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [resetFocusKey]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  }

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="flex items-end gap-2 border-t border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <label htmlFor="chat-input" className="sr-only">
        Nachricht an den KI-Assistenten
      </label>
      <textarea
        id="chat-input"
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        placeholder="Beschreibe deine Beobachtung..."
        className="flex-1 resize-none rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-900"
        style={{ maxHeight: '8rem' }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={!canSend}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-600"
      >
        Senden
      </button>
    </div>
  );
}
