import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ModalBody, ModalFooter, ModalHeader, useModalTitleId } from '../../../ui';
import {
  observationKey,
  labReportKey,
  labValueKey,
  supplementKey,
  openPointKey,
  profileVersionKey,
  timelineEntryKey,
  type ConflictResolution,
  type MergeMatch,
  type MergeResolutions,
  type MergeableEntityKey,
} from '../../../domain/import-merge';
import type { MergeConflictSet } from '../import/detectMergeConflicts';

interface ConflictResolutionDialogProps {
  /** Conflict set as captured by `detectMergeConflicts`. */
  conflicts: MergeConflictSet;
  /** Display name of the target profile. Surfaced in the heading. */
  targetProfileName: string;
  /**
   * Caller submits the collected resolutions back to the state machine.
   * Receives an empty object when no conflicts existed (the parent
   * should not render this dialog in that case; a defensive empty
   * payload is still typed correctly).
   */
  onSubmit: (resolutions: MergeResolutions) => void;
  /**
   * Cancel flow per spec W2 (W3 in Step 4 watch points): full
   * cancel-import. State machine returns to entry; vault unchanged.
   */
  onCancel: () => void;
}

/**
 * Conflict-pick = `'mine'` | `'theirs'` for the IM-06 Step 5a dialog.
 * Step 5b adds `'field-by-field'`; the radio is rendered disabled
 * here with a "coming soon" tooltip so users see the intended option
 * without it being functional.
 */
type ConflictPick = 'mine' | 'theirs';

/**
 * IM-06 Step 5a: dialog that surfaces every conflict produced by the
 * pre-transaction merge dry-run and collects per-conflict picks
 * (mine / theirs). Q2 discipline: no default radio preselection;
 * Confirm stays disabled until every conflict has an explicit pick.
 *
 * Sections render per entity type with non-zero conflict counts.
 * Section ordering follows `SECTION_ORDER` below; default expansion
 * state shows the first non-empty section open and the rest collapsed
 * (W2 from Step 5 watch points; trades initial visibility for less
 * scroll on profile-wide conflict sets).
 *
 * Field-by-field expansion is deferred to Step 5b. The third radio
 * renders disabled with the i18n key `mode.field-by-field-disabled`
 * so the UX shape is visible from day one.
 *
 * Cancel + ESC: defer to the parent state machine via `onCancel`.
 * No "are you sure" guard in v1; the user has not committed any
 * write yet (W4 atomicity). A polish-marker can add a confirm
 * sub-dialog later if real users discard their picks accidentally.
 */
export function ConflictResolutionDialog({
  conflicts,
  targetProfileName,
  onSubmit,
  onCancel,
}: ConflictResolutionDialogProps) {
  const { t } = useTranslation('import');
  const titleId = useModalTitleId();

  // Local-only resolution state until Confirm. Avoids round-tripping
  // every click through the import state machine (W5 from Step 5
  // watch points). Keyed by entity type then by existing-row id.
  const [picks, setPicks] = useState<{
    [K in MergeableEntityKey]?: Record<string, ConflictPick>;
  }>({});

  const sections = useMemo(() => buildSections(conflicts), [conflicts]);
  const totalConflicts = sections.reduce((acc, s) => acc + s.matches.length, 0);

  const resolvedCount = useMemo(() => {
    let n = 0;
    for (const section of sections) {
      const map = picks[section.kind];
      if (!map) continue;
      for (const m of section.matches) {
        if (map[m.existing.id] !== undefined) n += 1;
      }
    }
    return n;
  }, [sections, picks]);

  const allPicked = resolvedCount === totalConflicts;

  // Section-expansion state. Default: first section expanded.
  const [expanded, setExpanded] = useState<Record<MergeableEntityKey, boolean>>(() => {
    const init = {} as Record<MergeableEntityKey, boolean>;
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if (s) init[s.kind] = i === 0;
    }
    return init;
  });

  function toggleSection(kind: MergeableEntityKey): void {
    setExpanded((prev) => ({ ...prev, [kind]: !prev[kind] }));
  }

  function setPick(kind: MergeableEntityKey, existingId: string, pick: ConflictPick): void {
    setPicks((prev) => ({
      ...prev,
      [kind]: { ...(prev[kind] ?? {}), [existingId]: pick },
    }));
  }

  function handleConfirm(): void {
    if (!allPicked) return;
    const payload: MergeResolutions = {};
    for (const section of sections) {
      const map = picks[section.kind];
      if (!map) continue;
      const slice: Record<string, ConflictResolution<MergeableEntityKey>> = {};
      for (const m of section.matches) {
        const pick = map[m.existing.id];
        if (pick === undefined) continue;
        slice[m.existing.id] = { kind: pick };
      }
      assignResolutionSlice(payload, section.kind, slice);
    }
    onSubmit(payload);
  }

  return (
    <Modal
      open
      onClose={onCancel}
      titleId={titleId}
      role="dialog"
      closeOnEscape
      closeOnBackdropClick={false}
      size="lg"
      testId="conflict-resolution-dialog"
    >
      <ModalHeader titleId={titleId} titleTestId="conflict-resolution-dialog-title">
        {t('merge-conflicts.heading')}
      </ModalHeader>
      <ModalBody>
        <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
          {t('merge-conflicts.intro', { name: targetProfileName, total: totalConflicts })}
        </p>
        <p
          className="mb-4 text-xs font-medium text-gray-700 dark:text-gray-300"
          data-testid="conflict-resolution-dialog-progress"
        >
          {t('merge-conflicts.progress', { resolved: resolvedCount, total: totalConflicts })}
        </p>
        <div className="space-y-3">
          {sections.map((section) => (
            <ConflictSection
              key={section.kind}
              section={section}
              isExpanded={!!expanded[section.kind]}
              picks={picks[section.kind] ?? {}}
              onToggle={() => toggleSection(section.kind)}
              onPick={(id, pick) => setPick(section.kind, id, pick)}
            />
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={onCancel}
          data-testid="conflict-resolution-dialog-cancel"
          className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {t('merge-conflicts.footer.cancel')}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!allPicked}
          data-testid="conflict-resolution-dialog-confirm"
          className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('merge-conflicts.footer.confirm')}
        </button>
      </ModalFooter>
    </Modal>
  );
}

/**
 * Section descriptor: one entry per entity type that has at least
 * one conflict in the current set.
 */
interface SectionDescriptor {
  kind: MergeableEntityKey;
  matches: Extract<MergeMatch<MergeableEntityKey>, { outcome: 'conflict' }>[];
}

const SECTION_ORDER: MergeableEntityKey[] = [
  'observations',
  'labReports',
  'labValues',
  'supplements',
  'openPoints',
  'profileVersions',
  'timelineEntries',
];

function buildSections(conflicts: MergeConflictSet): SectionDescriptor[] {
  const out: SectionDescriptor[] = [];
  for (const k of SECTION_ORDER) {
    const matches = conflicts[k];
    if (matches.length > 0) {
      out.push({
        kind: k,
        matches: matches as Extract<MergeMatch<MergeableEntityKey>, { outcome: 'conflict' }>[],
      });
    }
  }
  return out;
}

/**
 * Cast helper: assign a per-type resolution slice into the
 * MergeResolutions union without TS complaining about the K-narrowed
 * generic. The dialog has already enforced shape via SECTION_ORDER +
 * the matcher's discriminated-union output.
 */
function assignResolutionSlice(
  target: MergeResolutions,
  kind: MergeableEntityKey,
  slice: Record<string, ConflictResolution<MergeableEntityKey>>,
): void {
  (target as Record<string, unknown>)[kind] = slice;
}

interface ConflictSectionProps {
  section: SectionDescriptor;
  isExpanded: boolean;
  picks: Record<string, ConflictPick>;
  onToggle: () => void;
  onPick: (existingId: string, pick: ConflictPick) => void;
}

function ConflictSection({ section, isExpanded, picks, onToggle, onPick }: ConflictSectionProps) {
  const { t } = useTranslation('import');
  const sectionId = `conflict-section-${section.kind}`;
  const headerId = `${sectionId}-header`;
  const headingKey = `merge-conflicts.section.${section.kind}` as const;

  return (
    <section
      data-testid={`conflict-resolution-section-${section.kind}`}
      className="rounded-sm border border-gray-200 dark:border-gray-700"
    >
      <h3 id={headerId} className="m-0">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={sectionId}
          onClick={onToggle}
          data-testid={`conflict-resolution-section-toggle-${section.kind}`}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800"
        >
          <span>{t(headingKey)}</span>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {t('merge-conflicts.section.count', { count: section.matches.length })}
          </span>
        </button>
      </h3>
      {isExpanded && (
        <div
          id={sectionId}
          role="region"
          aria-labelledby={headerId}
          className="border-t border-gray-200 p-3 dark:border-gray-700"
        >
          <div className="space-y-3">
            {section.matches.map((m) => (
              <ConflictRow
                key={m.existing.id}
                kind={section.kind}
                match={m}
                pick={picks[m.existing.id]}
                onPick={(p) => onPick(m.existing.id, p)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

interface ConflictRowProps {
  kind: MergeableEntityKey;
  match: Extract<MergeMatch<MergeableEntityKey>, { outcome: 'conflict' }>;
  pick: ConflictPick | undefined;
  onPick: (pick: ConflictPick) => void;
}

function ConflictRow({ kind, match, pick, onPick }: ConflictRowProps) {
  const { t } = useTranslation('import');
  const groupId = `conflict-row-${match.existing.id}`;
  const identityKey = identityKeyFor(kind, match.existing);
  const fieldList = match.diffs.map((d) => d.field).join(', ');

  return (
    <div
      data-testid={`conflict-resolution-row-${match.existing.id}`}
      className="rounded-sm border border-gray-200 p-3 dark:border-gray-700"
    >
      <p className="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
        {t('merge-conflicts.row.label-key', { key: identityKey })}
      </p>
      <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
        {t('merge-conflicts.row.diff-fields', { fields: fieldList })}
      </p>
      <div role="radiogroup" aria-label={identityKey} className="flex flex-wrap gap-3">
        <RadioOption
          name={groupId}
          value="mine"
          checked={pick === 'mine'}
          label={t('merge-conflicts.mode.mine')}
          onSelect={() => onPick('mine')}
          testId={`${groupId}-mine`}
        />
        <RadioOption
          name={groupId}
          value="theirs"
          checked={pick === 'theirs'}
          label={t('merge-conflicts.mode.theirs')}
          onSelect={() => onPick('theirs')}
          testId={`${groupId}-theirs`}
        />
        <RadioOption
          name={groupId}
          value="field-by-field"
          checked={false}
          disabled
          label={t('merge-conflicts.mode.field-by-field-disabled')}
          onSelect={() => {
            /* Step 5b */
          }}
          testId={`${groupId}-field-by-field`}
        />
      </div>
    </div>
  );
}

interface RadioOptionProps {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  disabled?: boolean;
  onSelect: () => void;
  testId: string;
}

function RadioOption({
  name,
  value,
  checked,
  label,
  disabled,
  onSelect,
  testId,
}: RadioOptionProps) {
  return (
    <label
      className={`flex items-center gap-2 text-sm ${
        disabled
          ? 'cursor-not-allowed text-gray-400 dark:text-gray-500'
          : 'text-gray-800 dark:text-gray-200'
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        data-testid={testId}
      />
      <span>{label}</span>
    </label>
  );
}

/**
 * Render a user-readable identity for one conflict's existing row.
 * Mirrors the natural-key extractors so the UI labels reflect the
 * exact comparison key used by the matcher.
 */
function identityKeyFor(kind: MergeableEntityKey, existing: { id: string }): string {
  // The match payload's `existing` is typed `MergeEntity<K>` per the
  // discriminated union, but TS cannot narrow K from the runtime
  // string `kind`. Cast through unknown for each branch; the field
  // lookups are guarded by `kind`.
  const e = existing as unknown as Record<string, unknown>;
  switch (kind) {
    case 'observations':
      return observationKey(e as { theme: string });
    case 'labReports':
      return labReportKey(e as { reportDate: string });
    case 'labValues':
      return labValueKey(e as { parameter: string });
    case 'supplements':
      return supplementKey(e as { name: string; brand?: string });
    case 'openPoints':
      return openPointKey(e as { context: string; text: string });
    case 'profileVersions':
      return profileVersionKey(e as { version: string });
    case 'timelineEntries':
      return timelineEntryKey(e as { period: string; title: string });
  }
}
