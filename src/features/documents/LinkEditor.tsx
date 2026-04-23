import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Document } from '../../domain';
import { DocumentRepository } from '../../db/repositories';
import { useLinkableEntities } from './useLinkableEntities';

export interface LinkEditorProps {
  document: Document;
  /** Fired after a successful link mutation so the parent can refetch. */
  onChanged: (updated: Document) => void;
}

type PickerMode = 'none' | 'observation' | 'lab-value';

/**
 * Viewer sub-component for reading and editing a document's link to
 * either an observation or a lab value (mutually exclusive).
 *
 * States rendered:
 * - Not linked: label + two "Link to..." buttons.
 * - Linked + entity resolves: "Linked to <name>" with a router Link
 *   into the target view, plus an "Unlink" button.
 * - Linked + entity missing: warning "Linked entity no longer exists"
 *   plus an "Unlink" button to clean up.
 * - Picker open: inline `<select>` populated by `useLinkableEntities`,
 *   plus Save / Cancel buttons.
 */
export function LinkEditor({ document, onChanged }: LinkEditorProps) {
  const { t } = useTranslation('documents');
  const entities = useLinkableEntities();
  const [picker, setPicker] = useState<PickerMode>('none');
  const [selected, setSelected] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentKind = document.linkedObservationId
    ? 'observation'
    : document.linkedLabValueId
      ? 'lab-value'
      : 'none';

  const resolvedLabel = resolveCurrentLabel(document, entities);
  const isUnresolved = currentKind !== 'none' && resolvedLabel === null;

  const openPicker = useCallback((mode: Exclude<PickerMode, 'none'>) => {
    setPicker(mode);
    setSelected('');
    setError(null);
  }, []);

  const cancelPicker = useCallback(() => {
    setPicker('none');
    setSelected('');
    setError(null);
  }, []);

  const save = useCallback(async () => {
    if (picker === 'none' || !selected) return;
    setSaving(true);
    setError(null);
    try {
      const repo = new DocumentRepository();
      const updated =
        picker === 'observation'
          ? await repo.linkToObservation(document.id, selected)
          : await repo.linkToLabValue(document.id, selected);
      onChanged(updated);
      setPicker('none');
      setSelected('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [picker, selected, document.id, onChanged]);

  const unlink = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const repo = new DocumentRepository();
      const updated = await repo.unlink(document.id);
      onChanged(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [document.id, onChanged]);

  return (
    <section
      className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800"
      aria-labelledby={`link-editor-heading-${document.id}`}
      data-testid="link-editor"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          id={`link-editor-heading-${document.id}`}
          className="font-medium text-gray-900 dark:text-gray-100"
        >
          {t('viewer.link.heading')}
        </span>
        {picker === 'none' && (
          <LinkStatus document={document} resolvedLabel={resolvedLabel} unresolved={isUnresolved} />
        )}
      </div>

      {picker === 'none' && (
        <div className="mt-2 flex flex-wrap gap-2">
          {currentKind === 'none' && (
            <>
              <button
                type="button"
                onClick={() => openPicker('observation')}
                disabled={entities.kind !== 'loaded'}
                className="rounded-md border border-gray-300 bg-white px-3 py-1 text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                data-testid="link-to-observation-btn"
              >
                {t('viewer.link.to-observation')}
              </button>
              <button
                type="button"
                onClick={() => openPicker('lab-value')}
                disabled={entities.kind !== 'loaded'}
                className="rounded-md border border-gray-300 bg-white px-3 py-1 text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                data-testid="link-to-lab-value-btn"
              >
                {t('viewer.link.to-lab-value')}
              </button>
            </>
          )}
          {currentKind !== 'none' && (
            <button
              type="button"
              onClick={unlink}
              disabled={saving}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
              data-testid="unlink-btn"
            >
              {t('viewer.link.unlink')}
            </button>
          )}
        </div>
      )}

      {picker !== 'none' && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor={`link-picker-${document.id}`}>
            {picker === 'observation'
              ? t('viewer.link.picker-observation')
              : t('viewer.link.picker-lab-value')}
          </label>
          <select
            id={`link-picker-${document.id}`}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={saving || entities.kind !== 'loaded'}
            className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            data-testid="link-picker-select"
          >
            <option value="">
              {picker === 'observation'
                ? t('viewer.link.picker-observation')
                : t('viewer.link.picker-lab-value')}
            </option>
            {entities.kind === 'loaded' &&
              (picker === 'observation' ? entities.observations : entities.labValues).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!selected || saving}
              className="rounded-md bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="link-save-btn"
            >
              {t('viewer.link.save')}
            </button>
            <button
              type="button"
              onClick={cancelPicker}
              disabled={saving}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
              data-testid="link-cancel-btn"
            >
              {t('viewer.link.cancel')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-2 text-xs text-red-600 dark:text-red-400"
          data-testid="link-editor-error"
        >
          {error}
        </p>
      )}
    </section>
  );
}

function LinkStatus({
  document,
  resolvedLabel,
  unresolved,
}: {
  document: Document;
  resolvedLabel: string | null;
  unresolved: boolean;
}) {
  const { t } = useTranslation('documents');
  if (!document.linkedObservationId && !document.linkedLabValueId) {
    return (
      <span
        className="text-gray-600 dark:text-gray-400"
        data-testid="link-status"
        data-state="none"
      >
        {t('viewer.link.none')}
      </span>
    );
  }

  if (unresolved) {
    return (
      <span
        role="status"
        className="text-amber-700 dark:text-amber-400"
        data-testid="link-status"
        data-state="unresolved"
      >
        {t('viewer.link.missing-entity')}
      </span>
    );
  }

  const targetHref = document.linkedObservationId
    ? '/observations'
    : document.linkedLabValueId
      ? '/lab-values'
      : '/documents';

  return (
    <span data-testid="link-status" data-state="linked" className="inline-flex items-center gap-1">
      <span className="text-gray-700 dark:text-gray-300">{t('viewer.link.linked-prefix')}</span>
      <Link
        to={targetHref}
        className="text-blue-700 hover:text-blue-900 hover:underline dark:text-blue-300 dark:hover:text-blue-100"
        data-testid="link-status-target"
      >
        {resolvedLabel}
      </Link>
    </span>
  );
}

function resolveCurrentLabel(
  document: Document,
  entities: ReturnType<typeof useLinkableEntities>,
): string | null {
  if (entities.kind !== 'loaded') return null;
  if (document.linkedObservationId) {
    return entities.observations.find((o) => o.id === document.linkedObservationId)?.label ?? null;
  }
  if (document.linkedLabValueId) {
    return entities.labValues.find((v) => v.id === document.linkedLabValueId)?.label ?? null;
  }
  return null;
}
