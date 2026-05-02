import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog as O20ConfirmDialog } from '../../../ui';
import type { EntityCounts, ImportMode, PerTypeMode } from '../import';

interface ConfirmDialogProps {
  existingCounts: EntityCounts;
  /**
   * IM-05 Option B: counts from the parsed source. Combined with
   * `existingCounts` to decide which type rows render and which
   * modes are available per row. A type with `parsed > 0` and
   * `existing = 0` shows only Add + Skip (nothing to replace); a
   * type with `parsed = 0` and `existing > 0` shows only Replace +
   * Skip (nothing to add); both > 0 shows the full Replace / Add /
   * Skip triple. Both 0 hides the row entirely.
   */
  parsedCounts: EntityCounts;
  targetProfileName: string;
  onConfirm: (selection: PerTypeMode) => void;
  onCancel: () => void;
}

type RowKey = keyof PerTypeMode;

interface RowDescriptor {
  key: RowKey;
  existing: number;
  parsed: number;
  /** Optional secondary count rendered next to the primary (lab values
   *  alongside lab reports). Display-only; not used for gating. */
  secondaryParsed?: number;
  secondaryExisting?: number;
}

function rowsFromCounts(existing: EntityCounts, parsed: EntityCounts): RowDescriptor[] {
  const rows: RowDescriptor[] = [
    { key: 'observations', existing: existing.observations, parsed: parsed.observations },
    {
      key: 'labData',
      existing: existing.labReports,
      parsed: parsed.labReports,
      secondaryExisting: existing.labValues,
      secondaryParsed: parsed.labValues,
    },
    { key: 'supplements', existing: existing.supplements, parsed: parsed.supplements },
    { key: 'openPoints', existing: existing.openPoints, parsed: parsed.openPoints },
    { key: 'timelineEntries', existing: existing.timelineEntries, parsed: parsed.timelineEntries },
    { key: 'profileVersions', existing: existing.profileVersions, parsed: parsed.profileVersions },
  ];
  return rows.filter(
    (r) =>
      r.existing > 0 ||
      r.parsed > 0 ||
      (r.secondaryExisting ?? 0) > 0 ||
      (r.secondaryParsed ?? 0) > 0,
  );
}

/**
 * Destructive-action modal shown when the import target already
 * holds data OR the source carries data the user might want to
 * choose how to handle. Composes the shared `<ConfirmDialog>` from
 * `src/ui/Modal/`: focus trap, Escape close, backdrop, and
 * destructive-variant chrome (red confirm button + role="alertdialog")
 * provided by the primitive.
 *
 * IM-05 Option B (2026-05-01): three modes per type - replace, add,
 * skip. No defaults; user must explicitly pick a mode for every
 * visible row before Confirm enables. Add-mode surfaces a warning
 * hint about possible duplicates because this build does not
 * deduplicate by content (Q3 lock from the user's spec).
 *
 * Lab data stays a single combined toggle (Q4 lock, parity with the
 * import transaction body). Profile metadata is always merged
 * (Q5 lock, identity-level data is never wiped by per-type modes).
 */
export function ConfirmDialog({
  existingCounts,
  parsedCounts,
  targetProfileName,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation('import');
  const rows = useMemo(
    () => rowsFromCounts(existingCounts, parsedCounts),
    [existingCounts, parsedCounts],
  );

  const [selection, setSelection] = useState<Partial<Record<RowKey, ImportMode>>>({});

  const allModesPicked = rows.every((r) => selection[r.key] !== undefined);
  const anyAdd = rows.some((r) => selection[r.key] === 'add');

  const setMode = (key: RowKey, mode: ImportMode) => {
    setSelection((prev) => ({ ...prev, [key]: mode }));
  };

  const handleConfirm = () => {
    // Translate the partial selection into a full PerTypeMode object;
    // missing keys (rows that did not render) default to 'skip' inside
    // the resolver.
    const payload: PerTypeMode = {};
    for (const r of rows) {
      const m = selection[r.key];
      if (m !== undefined) payload[r.key] = m;
    }
    onConfirm(payload);
  };

  return (
    <O20ConfirmDialog
      open
      onClose={onCancel}
      title={t('confirm.heading')}
      body={
        <>
          <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
            {t('confirm.body', { name: targetProfileName })}
          </p>
          <p className="mb-4 text-xs text-gray-600 dark:text-gray-400">
            {t('confirm.modes-explainer')}
          </p>
          <fieldset className="mb-4 space-y-3">
            <legend className="mb-2 font-medium">{t('confirm.toggle-legend')}</legend>
            {rows.map((row) => (
              <ModeRow
                key={row.key}
                row={row}
                selected={selection[row.key]}
                onSelect={(m) => setMode(row.key, m)}
              />
            ))}
          </fieldset>
          {anyAdd && (
            <p
              role="note"
              data-testid="confirm-add-warning"
              className="mb-3 rounded-sm border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
            >
              {t('confirm.add-warning')}
            </p>
          )}
          <p className="text-sm text-red-700 dark:text-red-300">{t('confirm.warning')}</p>
        </>
      }
      cancelLabel={t('common:action.cancel')}
      confirmLabel={t('confirm.confirm')}
      onConfirm={handleConfirm}
      variant="destructive"
      confirmDisabled={!allModesPicked}
    />
  );
}

function ModeRow({
  row,
  selected,
  onSelect,
}: {
  row: RowDescriptor;
  selected: ImportMode | undefined;
  onSelect: (mode: ImportMode) => void;
}) {
  const { t } = useTranslation('import');
  const groupId = `confirm-mode-${row.key}`;

  const replaceAvailable = row.existing > 0 || (row.secondaryExisting ?? 0) > 0;
  const addAvailable = row.parsed > 0 || (row.secondaryParsed ?? 0) > 0;

  return (
    <div className="rounded-sm border border-gray-200 p-2 dark:border-gray-700">
      <p className="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
        <RowLabel row={row} />
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        data-testid={`confirm-row-${row.key}`}
        className="flex flex-wrap gap-3"
      >
        <ModeRadio
          name={groupId}
          value="replace"
          checked={selected === 'replace'}
          disabled={!replaceAvailable}
          label={t('confirm.mode.replace')}
          onSelect={() => onSelect('replace')}
          testId={`confirm-row-${row.key}-replace`}
        />
        <ModeRadio
          name={groupId}
          value="add"
          checked={selected === 'add'}
          disabled={!addAvailable}
          label={t('confirm.mode.add')}
          onSelect={() => onSelect('add')}
          testId={`confirm-row-${row.key}-add`}
        />
        <ModeRadio
          name={groupId}
          value="skip"
          checked={selected === 'skip'}
          label={t('confirm.mode.skip')}
          onSelect={() => onSelect('skip')}
          testId={`confirm-row-${row.key}-skip`}
        />
      </div>
    </div>
  );
}

function ModeRadio({
  name,
  value,
  checked,
  disabled = false,
  label,
  onSelect,
  testId,
}: {
  name: string;
  value: ImportMode;
  checked: boolean;
  disabled?: boolean;
  label: string;
  onSelect: () => void;
  testId: string;
}) {
  return (
    <label className={`flex items-center gap-1.5 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect()}
        data-testid={testId}
        className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function RowLabel({ row }: { row: RowDescriptor }) {
  const { t } = useTranslation('import');
  switch (row.key) {
    case 'observations':
      return (
        <>
          {t('confirm.row.observations', {
            existing: row.existing,
            parsed: row.parsed,
          })}
        </>
      );
    case 'labData':
      return (
        <>
          {t('confirm.row.lab-data', {
            existing: row.existing,
            existingValues: row.secondaryExisting ?? 0,
            parsed: row.parsed,
            parsedValues: row.secondaryParsed ?? 0,
          })}
        </>
      );
    case 'supplements':
      return (
        <>
          {t('confirm.row.supplements', {
            existing: row.existing,
            parsed: row.parsed,
          })}
        </>
      );
    case 'openPoints':
      return (
        <>
          {t('confirm.row.open-points', {
            existing: row.existing,
            parsed: row.parsed,
          })}
        </>
      );
    case 'timelineEntries':
      return (
        <>
          {t('confirm.row.timeline-entries', {
            existing: row.existing,
            parsed: row.parsed,
          })}
        </>
      );
    case 'profileVersions':
      return (
        <>
          {t('confirm.row.profile-versions', {
            existing: row.existing,
            parsed: row.parsed,
          })}
        </>
      );
  }
}
