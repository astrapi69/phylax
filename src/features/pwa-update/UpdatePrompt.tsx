interface UpdatePromptProps {
  needRefresh: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}

/**
 * Toast-style banner shown when a new service worker version is ready.
 * Non-blocking: user can continue using the current session.
 */
export function UpdatePrompt({ needRefresh, onUpdate, onDismiss }: UpdatePromptProps) {
  if (!needRefresh) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg bg-gray-800 p-4 shadow-lg"
      role="alert"
    >
      <p className="mb-3 text-sm text-white">Eine neue Version ist verfuegbar.</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onUpdate}
          className="rounded bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
        >
          Jetzt aktualisieren
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded bg-gray-600 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-500"
        >
          Spaeter
        </button>
      </div>
    </div>
  );
}
