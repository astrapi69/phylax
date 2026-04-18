import type { ChangeEvent } from 'react';
import type { SortMode } from './sorting';

interface ObservationsSortToggleProps {
  mode: SortMode;
  onChange: (mode: SortMode) => void;
}

/**
 * Header-local sort-mode switcher. Native select so keyboard handling,
 * screen reader announcements, and mobile touch UX all come for free.
 */
export function ObservationsSortToggle({ mode, onChange }: ObservationsSortToggleProps) {
  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === 'recent' || value === 'alphabetical') {
      onChange(value);
    }
  }

  return (
    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
      <span className="sr-only">Sortierung</span>
      <span aria-hidden>Sortierung:</span>
      <select
        value={mode}
        onChange={handleChange}
        aria-label="Sortierung"
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        <option value="recent">Kuerzlich zuerst</option>
        <option value="alphabetical">Alphabetisch</option>
      </select>
    </label>
  );
}
