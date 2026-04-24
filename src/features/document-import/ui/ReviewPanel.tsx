import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ExtractedDrafts,
  LabValueDraft,
  ObservationDraft,
  OpenPointDraft,
  SupplementDraft,
} from '../drafts';
import type { DraftSelection } from '../commit';
import type { SupplementCategory } from '../../../domain/supplement/types';

export interface ReviewPanelProps {
  drafts: ExtractedDrafts;
  selection: DraftSelection;
  onSelectionChange: (next: DraftSelection) => void;
  onEditObservation: (index: number, patch: Partial<ObservationDraft>) => void;
  onEditLabValue: (index: number, patch: Partial<LabValueDraft>) => void;
  onEditSupplement: (index: number, patch: Partial<SupplementDraft>) => void;
  onEditOpenPoint: (index: number, patch: Partial<OpenPointDraft>) => void;
}

const SUPPLEMENT_CATEGORIES: SupplementCategory[] = ['daily', 'regular', 'paused', 'on-demand'];

/**
 * Review surface for the IMP-04 import flow.
 *
 * Renders four collapsible sections (one per draft type). Each row
 * has a "keep" checkbox (default checked) and an "edit" toggle that
 * expands an inline form. Unchecking == discarding; there is no
 * separate discard action by design (one less click).
 *
 * Lab-values section shows a hint banner explaining that a synthetic
 * `LabReport` will be created on commit, with the AI-extracted
 * report date (or today as fallback) and lab name when present.
 */
export function ReviewPanel({
  drafts,
  selection,
  onSelectionChange,
  onEditObservation,
  onEditLabValue,
  onEditSupplement,
  onEditOpenPoint,
}: ReviewPanelProps) {
  const { t, i18n } = useTranslation('document-import');

  const todayIso = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear().toString().padStart(4, '0');
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const labMetaHint = useMemo(() => {
    const date = drafts.labReportMeta.reportDate ?? todayIso;
    const labName = drafts.labReportMeta.labName;
    if (labName) {
      return t('import.review.lab-meta-hint-with-name', { date, labName });
    }
    return t('import.review.lab-meta-hint', { date });
  }, [drafts.labReportMeta, todayIso, t]);

  const toggleObservation = (idx: number, on: boolean) =>
    onSelectionChange({
      ...selection,
      observations: toggleIndex(selection.observations, idx, on),
    });
  const toggleLabValue = (idx: number, on: boolean) =>
    onSelectionChange({ ...selection, labValues: toggleIndex(selection.labValues, idx, on) });
  const toggleSupplement = (idx: number, on: boolean) =>
    onSelectionChange({ ...selection, supplements: toggleIndex(selection.supplements, idx, on) });
  const toggleOpenPoint = (idx: number, on: boolean) =>
    onSelectionChange({ ...selection, openPoints: toggleIndex(selection.openPoints, idx, on) });

  const lang = i18n.language;
  return (
    <div className="flex flex-col gap-5" data-testid="review-panel">
      <Section
        title={t('import.review.section.observations')}
        count={drafts.observations.length}
        empty={t('import.review.empty')}
        items={drafts.observations}
        renderItem={(o, idx) => (
          <ObservationRow
            key={idx}
            draft={o}
            checked={selection.observations.includes(idx)}
            onToggle={(on) => toggleObservation(idx, on)}
            onEdit={(patch) => onEditObservation(idx, patch)}
            t={t}
          />
        )}
      />

      <Section
        title={t('import.review.section.lab-values')}
        count={drafts.labValues.length}
        empty={t('import.review.empty')}
        items={drafts.labValues}
        before={
          drafts.labValues.length > 0 ? (
            <p
              data-testid="lab-meta-hint"
              className="rounded-sm border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
            >
              {labMetaHint}
            </p>
          ) : null
        }
        renderItem={(v, idx) => (
          <LabValueRow
            key={idx}
            draft={v}
            checked={selection.labValues.includes(idx)}
            onToggle={(on) => toggleLabValue(idx, on)}
            onEdit={(patch) => onEditLabValue(idx, patch)}
            t={t}
          />
        )}
      />

      <Section
        title={t('import.review.section.supplements')}
        count={drafts.supplements.length}
        empty={t('import.review.empty')}
        items={drafts.supplements}
        renderItem={(s, idx) => (
          <SupplementRow
            key={idx}
            draft={s}
            checked={selection.supplements.includes(idx)}
            onToggle={(on) => toggleSupplement(idx, on)}
            onEdit={(patch) => onEditSupplement(idx, patch)}
            t={t}
            lang={lang}
          />
        )}
      />

      <Section
        title={t('import.review.section.open-points')}
        count={drafts.openPoints.length}
        empty={t('import.review.empty')}
        items={drafts.openPoints}
        renderItem={(p, idx) => (
          <OpenPointRow
            key={idx}
            draft={p}
            checked={selection.openPoints.includes(idx)}
            onToggle={(on) => toggleOpenPoint(idx, on)}
            onEdit={(patch) => onEditOpenPoint(idx, patch)}
            t={t}
          />
        )}
      />
    </div>
  );
}

interface SectionProps<T> {
  title: string;
  count: number;
  empty: string;
  items: readonly T[];
  before?: React.ReactNode;
  renderItem: (item: T, index: number) => React.ReactNode;
}

function Section<T>({ title, count, empty, items, before, renderItem }: SectionProps<T>) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-700 uppercase dark:text-gray-300">
        {title}
        <span className="rounded-sm bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
          {count}
        </span>
      </h3>
      {before}
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 italic dark:text-gray-400">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">{items.map((item, idx) => renderItem(item, idx))}</ul>
      )}
    </section>
  );
}

interface RowChromeProps {
  checked: boolean;
  onToggle: (on: boolean) => void;
  summary: React.ReactNode;
  editToggleLabel: string;
  editing: boolean;
  onEditToggle: () => void;
  editor?: React.ReactNode;
  testId: string;
}

function RowChrome({
  checked,
  onToggle,
  summary,
  editToggleLabel,
  editing,
  onEditToggle,
  editor,
  testId,
}: RowChromeProps) {
  return (
    <li
      data-testid={testId}
      className="rounded-sm border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-1"
          aria-label="select"
        />
        <div className="flex-1 text-sm text-gray-800 dark:text-gray-200">{summary}</div>
        <button
          type="button"
          onClick={onEditToggle}
          className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
        >
          {editToggleLabel}
        </button>
      </div>
      {editing && editor ? <div className="mt-3 flex flex-col gap-2">{editor}</div> : null}
    </li>
  );
}

type T = ReturnType<typeof useTranslation<'document-import'>>['t'];

function ObservationRow({
  draft,
  checked,
  onToggle,
  onEdit,
  t,
}: {
  draft: ObservationDraft;
  checked: boolean;
  onToggle: (on: boolean) => void;
  onEdit: (patch: Partial<ObservationDraft>) => void;
  t: T;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <RowChrome
      testId="observation-row"
      checked={checked}
      onToggle={onToggle}
      summary={
        <div>
          <strong className="font-semibold">{draft.theme || '—'}</strong>
          {draft.fact && <span> — {draft.fact}</span>}
        </div>
      }
      editToggleLabel={editing ? t('import.review.edit-done') : t('import.review.edit')}
      editing={editing}
      onEditToggle={() => setEditing((b) => !b)}
      editor={
        <>
          <Field label={t('import.review.fields.theme')}>
            <input
              type="text"
              value={draft.theme}
              onChange={(e) => onEdit({ theme: e.target.value })}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.fact')}>
            <textarea
              value={draft.fact}
              onChange={(e) => onEdit({ fact: e.target.value })}
              rows={2}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.pattern')}>
            <textarea
              value={draft.pattern}
              onChange={(e) => onEdit({ pattern: e.target.value })}
              rows={2}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.self-regulation')}>
            <textarea
              value={draft.selfRegulation}
              onChange={(e) => onEdit({ selfRegulation: e.target.value })}
              rows={2}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.status')}>
            <input
              type="text"
              value={draft.status}
              onChange={(e) => onEdit({ status: e.target.value })}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.medical-finding')}>
            <textarea
              value={draft.medicalFinding ?? ''}
              onChange={(e) => onEdit({ medicalFinding: emptyToUndefined(e.target.value) })}
              rows={2}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.relevance-notes')}>
            <textarea
              value={draft.relevanceNotes ?? ''}
              onChange={(e) => onEdit({ relevanceNotes: emptyToUndefined(e.target.value) })}
              rows={2}
              className={inputClasses()}
            />
          </Field>
        </>
      }
    />
  );
}

function LabValueRow({
  draft,
  checked,
  onToggle,
  onEdit,
  t,
}: {
  draft: LabValueDraft;
  checked: boolean;
  onToggle: (on: boolean) => void;
  onEdit: (patch: Partial<LabValueDraft>) => void;
  t: T;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <RowChrome
      testId="lab-value-row"
      checked={checked}
      onToggle={onToggle}
      summary={
        <div>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {draft.category || '—'}
          </span>
          <div>
            <strong>{draft.parameter || '—'}</strong>: {draft.result || '—'}
            {draft.unit ? ` ${draft.unit}` : ''}
            {draft.assessment ? ` (${draft.assessment})` : ''}
          </div>
        </div>
      }
      editToggleLabel={editing ? t('import.review.edit-done') : t('import.review.edit')}
      editing={editing}
      onEditToggle={() => setEditing((b) => !b)}
      editor={
        <>
          <Field label={t('import.review.fields.category')}>
            <input
              type="text"
              value={draft.category}
              onChange={(e) => onEdit({ category: e.target.value })}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.parameter')}>
            <input
              type="text"
              value={draft.parameter}
              onChange={(e) => onEdit({ parameter: e.target.value })}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.result')}>
            <input
              type="text"
              value={draft.result}
              onChange={(e) => onEdit({ result: e.target.value })}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.unit')}>
            <input
              type="text"
              value={draft.unit ?? ''}
              onChange={(e) => onEdit({ unit: emptyToUndefined(e.target.value) })}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.reference-range')}>
            <input
              type="text"
              value={draft.referenceRange ?? ''}
              onChange={(e) => onEdit({ referenceRange: emptyToUndefined(e.target.value) })}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.assessment')}>
            <input
              type="text"
              value={draft.assessment ?? ''}
              onChange={(e) => onEdit({ assessment: emptyToUndefined(e.target.value) })}
              className={inputClasses()}
            />
          </Field>
        </>
      }
    />
  );
}

function SupplementRow({
  draft,
  checked,
  onToggle,
  onEdit,
  t,
  lang,
}: {
  draft: SupplementDraft;
  checked: boolean;
  onToggle: (on: boolean) => void;
  onEdit: (patch: Partial<SupplementDraft>) => void;
  t: T;
  lang: string;
}) {
  const [editing, setEditing] = useState(false);
  const categoryLabel = t(`import.review.supplement-category.${draft.category}`, { lng: lang });
  return (
    <RowChrome
      testId="supplement-row"
      checked={checked}
      onToggle={onToggle}
      summary={
        <div>
          <strong>{draft.name || '—'}</strong>
          {draft.brand ? <span className="ml-1 text-xs text-gray-500">({draft.brand})</span> : null}
          <span className="ml-2 text-xs text-gray-500">— {categoryLabel}</span>
        </div>
      }
      editToggleLabel={editing ? t('import.review.edit-done') : t('import.review.edit')}
      editing={editing}
      onEditToggle={() => setEditing((b) => !b)}
      editor={
        <>
          <Field label={t('import.review.fields.name')}>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => onEdit({ name: e.target.value })}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.brand')}>
            <input
              type="text"
              value={draft.brand ?? ''}
              onChange={(e) => onEdit({ brand: emptyToUndefined(e.target.value) })}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.category')}>
            <select
              value={draft.category}
              onChange={(e) => onEdit({ category: e.target.value as SupplementCategory })}
              className={inputClasses()}
            >
              {SUPPLEMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`import.review.supplement-category.${c}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('import.review.fields.recommendation')}>
            <textarea
              value={draft.recommendation ?? ''}
              onChange={(e) => onEdit({ recommendation: emptyToUndefined(e.target.value) })}
              rows={2}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.rationale')}>
            <textarea
              value={draft.rationale ?? ''}
              onChange={(e) => onEdit({ rationale: emptyToUndefined(e.target.value) })}
              rows={2}
              className={inputClasses()}
            />
          </Field>
        </>
      }
    />
  );
}

function OpenPointRow({
  draft,
  checked,
  onToggle,
  onEdit,
  t,
}: {
  draft: OpenPointDraft;
  checked: boolean;
  onToggle: (on: boolean) => void;
  onEdit: (patch: Partial<OpenPointDraft>) => void;
  t: T;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <RowChrome
      testId="open-point-row"
      checked={checked}
      onToggle={onToggle}
      summary={
        <div>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {draft.context || '—'}
          </span>
          <div>{draft.text || '—'}</div>
        </div>
      }
      editToggleLabel={editing ? t('import.review.edit-done') : t('import.review.edit')}
      editing={editing}
      onEditToggle={() => setEditing((b) => !b)}
      editor={
        <>
          <Field label={t('import.review.fields.text')}>
            <textarea
              value={draft.text}
              onChange={(e) => onEdit({ text: e.target.value })}
              rows={2}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.context')}>
            <input
              type="text"
              value={draft.context}
              onChange={(e) => onEdit({ context: e.target.value })}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.priority')}>
            <input
              type="text"
              value={draft.priority ?? ''}
              onChange={(e) => onEdit({ priority: emptyToUndefined(e.target.value) })}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.time-horizon')}>
            <input
              type="text"
              value={draft.timeHorizon ?? ''}
              onChange={(e) => onEdit({ timeHorizon: emptyToUndefined(e.target.value) })}
              className={inputClasses()}
            />
          </Field>
          <Field label={t('import.review.fields.details')}>
            <textarea
              value={draft.details ?? ''}
              onChange={(e) => onEdit({ details: emptyToUndefined(e.target.value) })}
              rows={2}
              className={inputClasses()}
            />
          </Field>
        </>
      }
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function inputClasses(): string {
  return 'rounded-sm border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-hidden dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
}

function emptyToUndefined(value: string): string | undefined {
  return value.length === 0 ? undefined : value;
}

function toggleIndex(list: readonly number[], idx: number, on: boolean): number[] {
  if (on) {
    if (list.includes(idx)) return [...list];
    return [...list, idx].sort((a, b) => a - b);
  }
  return list.filter((i) => i !== idx);
}
