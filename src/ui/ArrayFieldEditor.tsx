import { useId } from 'react';

export interface ArrayFieldEditorProps {
  /** Current array of string values. */
  values: string[];
  /** Called whenever the array changes (add/remove/edit). */
  onChange: (next: string[]) => void;
  /** Visible label above the editor; associated via htmlFor on first row. */
  label: string;
  /** Per-row placeholder for empty inputs. */
  placeholder?: string;
  /** Localized "add row" button text. */
  addLabel: string;
  /** aria-label template for delete buttons; receives the row index (1-based). */
  removeAriaLabel: (rowNumber: number) => string;
  /** Disable all interactive elements (e.g., during form submit). */
  disabled?: boolean;
  /** data-testid prefix for individual rows + buttons. */
  testIdPrefix: string;
}

/**
 * Generic string-array editor primitive. Renders one `<input type="text">`
 * per array entry plus an "add row" button. Each row has a delete button
 * (44x44 touch target, WCAG 2.5.5).
 *
 * Empty rows are NOT auto-trimmed here - the caller decides when to trim
 * (typically on form submit, via the same `emptyToUndefined`-style helper
 * that all CRUD form hooks use).
 *
 * Enter inside a row's `<input>` does NOT submit the parent form. Pressing
 * Enter while focused on the input is a no-op so users adding multiple
 * rows can keep going without accidentally committing the form. Backspace
 * inside an empty row does NOT auto-remove the row - explicit delete via
 * the button keeps the destructive action intentional.
 *
 * Used by the O-16 base-data form for the three string arrays
 * (knownDiagnoses, currentMedications, relevantLimitations).
 */
export function ArrayFieldEditor({
  values,
  onChange,
  label,
  placeholder,
  addLabel,
  removeAriaLabel,
  disabled = false,
  testIdPrefix,
}: ArrayFieldEditorProps) {
  const labelId = useId();

  const updateAt = (index: number, value: string): void => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };

  const removeAt = (index: number): void => {
    const next = values.filter((_, i) => i !== index);
    onChange(next);
  };

  const append = (): void => {
    onChange([...values, '']);
  };

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </span>
      {values.length === 0 ? null : (
        <ul className="flex flex-col gap-2" aria-labelledby={labelId}>
          {values.map((value, index) => (
            <li
              key={index}
              className="flex items-center gap-2"
              data-testid={`${testIdPrefix}-row-${index}`}
            >
              <input
                type="text"
                value={value}
                onChange={(e) => updateAt(index, e.target.value)}
                onKeyDown={(e) => {
                  // Prevent Enter from submitting the parent form. Users
                  // adding multiple rows keep going; explicit submit
                  // button click is required to commit.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                disabled={disabled}
                placeholder={placeholder}
                aria-labelledby={labelId}
                className="flex-1 rounded-sm border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                data-testid={`${testIdPrefix}-input-${index}`}
              />
              <button
                type="button"
                onClick={() => removeAt(index)}
                disabled={disabled}
                aria-label={removeAriaLabel(index + 1)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm px-2 text-sm text-red-700 hover:bg-red-50 hover:text-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-900/30"
                data-testid={`${testIdPrefix}-remove-${index}`}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={append}
        disabled={disabled}
        className="inline-flex min-h-[44px] w-fit items-center gap-1 rounded-sm border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-800"
        data-testid={`${testIdPrefix}-add`}
      >
        <span aria-hidden>+</span>
        {addLabel}
      </button>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      <path d="M5.5 1h5l.5 1H14v1H2V2h3l.5-1zM3.5 4h9l-.6 10a1 1 0 0 1-1 1H5.1a1 1 0 0 1-1-1L3.5 4zm2 2v7h1V6h-1zm3 0v7h1V6h-1z" />
    </svg>
  );
}
