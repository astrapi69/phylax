import { useCallback, useMemo, useState } from 'react';
import type { OpenPoint } from '../../domain';
import { OpenPointRepository, ProfileRepository } from '../../db/repositories';

/**
 * Mode the form opens in. `create` starts blank; `edit` prefills
 * from the supplied open point and preserves provenance fields
 * (`sourceDocumentId`, `id`, `profileId`, `createdAt`, `resolved`)
 * verbatim across the round-trip — `resolved` is owned by the toggle
 * path, not the edit form.
 */
export type OpenPointFormMode =
  | { kind: 'create' }
  | { kind: 'edit'; point: OpenPoint }
  | { kind: 'delete'; point: OpenPoint };

/** Field shape the form mutates locally before submit. */
export interface OpenPointFormFields {
  text: string;
  context: string;
  priority: string;
  timeHorizon: string;
  details: string;
}

export type OpenPointFormState =
  | { kind: 'closed' }
  | {
      kind: 'open';
      mode: OpenPointFormMode;
      fields: OpenPointFormFields;
      submitting: boolean;
      error: string | null;
      /** Profile-wide context suggestions, German-collated. */
      contexts: readonly string[];
    };

export interface UseOpenPointFormOptions {
  /** Called after a successful create/update/delete/toggle write. */
  onCommitted?: () => void;
  /** Repo overrides for tests. */
  repos?: {
    profile?: ProfileRepository;
    openPoint?: OpenPointRepository;
  };
}

export interface UseOpenPointFormResult {
  state: OpenPointFormState;
  openCreate: () => Promise<void>;
  openEdit: (point: OpenPoint) => Promise<void>;
  openDelete: (point: OpenPoint) => void;
  setField: <K extends keyof OpenPointFormFields>(key: K, value: OpenPointFormFields[K]) => void;
  submit: () => Promise<void>;
  confirmDelete: () => Promise<void>;
  close: () => void;
  /**
   * Toggle the `resolved` flag on a single open point. No-modal
   * fast-path: calls `repo.update(id, { resolved: !resolved })`,
   * triggers `onCommitted` on success. The id of the in-flight
   * point is exposed via `togglingId` so callers can disable the
   * checkbox during the brief mutation window.
   */
  toggle: (point: OpenPoint) => Promise<void>;
  /** ID of the open point currently being toggled, or null. */
  togglingId: string | null;
  /** Last toggle error, or null. Set by `toggle` on failure. */
  toggleError: string | null;
}

const EMPTY_FIELDS: OpenPointFormFields = {
  text: '',
  context: '',
  priority: '',
  timeHorizon: '',
  details: '',
};

function fieldsFrom(point: OpenPoint): OpenPointFormFields {
  return {
    text: point.text,
    context: point.context,
    priority: point.priority ?? '',
    timeHorizon: point.timeHorizon ?? '',
    details: point.details ?? '',
  };
}

/**
 * State machine for the O-15 open-point form. Drives create + edit +
 * delete via modal flows plus a no-modal `toggle` for the resolved
 * flag flip. Owns form fields locally and refreshes context
 * suggestions on every modal open (mirrors `useObservationForm.loadThemes`).
 *
 * Closure paths: `close` from cancel button or successful submit.
 * Submit errors keep the modal open with `error` populated; user
 * retries or cancels.
 *
 * Re-categorization: edit mode allows changing `context`; the parent
 * groups reshuffle on save through the `onCommitted` refetch.
 *
 * Toggle path is independent of the modal lifecycle — a checkbox
 * click inside the list fires `toggle(point)` directly without
 * opening anything. Phylax convention: await-confirm (no optimistic
 * UI). The brief in-flight window is exposed via `togglingId` so the
 * checkbox can disable to prevent double-click races.
 */
export function useOpenPointForm(options: UseOpenPointFormOptions = {}): UseOpenPointFormResult {
  const [state, setState] = useState<OpenPointFormState>({ kind: 'closed' });
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const profileRepo = useMemo(
    () => options.repos?.profile ?? new ProfileRepository(),
    [options.repos?.profile],
  );
  const repo = useMemo(
    () => options.repos?.openPoint ?? new OpenPointRepository(),
    [options.repos?.openPoint],
  );

  const loadContexts = useCallback(async (): Promise<readonly string[]> => {
    const profile = await profileRepo.getCurrentProfile();
    if (!profile) return [];
    const contexts = await repo.listContexts(profile.id);
    const collator = new Intl.Collator('de');
    return [...contexts].sort((a, b) => collator.compare(a, b));
  }, [profileRepo, repo]);

  const openCreate = useCallback(async () => {
    const contexts = await loadContexts();
    setState({
      kind: 'open',
      mode: { kind: 'create' },
      fields: EMPTY_FIELDS,
      submitting: false,
      error: null,
      contexts,
    });
  }, [loadContexts]);

  const openEdit = useCallback(
    async (point: OpenPoint) => {
      const contexts = await loadContexts();
      setState({
        kind: 'open',
        mode: { kind: 'edit', point },
        fields: fieldsFrom(point),
        submitting: false,
        error: null,
        contexts,
      });
    },
    [loadContexts],
  );

  const openDelete = useCallback((point: OpenPoint) => {
    setState({
      kind: 'open',
      mode: { kind: 'delete', point },
      fields: fieldsFrom(point),
      submitting: false,
      error: null,
      contexts: [],
    });
  }, []);

  const setField = useCallback<UseOpenPointFormResult['setField']>((key, value) => {
    setState((prev) => {
      if (prev.kind !== 'open') return prev;
      return { ...prev, fields: { ...prev.fields, [key]: value } };
    });
  }, []);

  const close = useCallback(() => setState({ kind: 'closed' }), []);

  const submit = useCallback(async () => {
    if (state.kind !== 'open') return;
    if (state.mode.kind === 'delete') return;

    const trimmedText = state.fields.text.trim();
    const trimmedContext = state.fields.context.trim();
    if (trimmedText.length === 0 || trimmedContext.length === 0) {
      return; // validation gate
    }

    setState({ ...state, submitting: true, error: null });
    try {
      if (state.mode.kind === 'create') {
        const profile = await profileRepo.getCurrentProfile();
        if (!profile) throw new Error('no-profile');
        await repo.create({
          profileId: profile.id,
          text: trimmedText,
          context: trimmedContext,
          resolved: false,
          priority: emptyToUndefined(state.fields.priority),
          timeHorizon: emptyToUndefined(state.fields.timeHorizon),
          details: emptyToUndefined(state.fields.details),
        });
      } else {
        const existing = state.mode.point;
        await repo.update(existing.id, {
          text: trimmedText,
          context: trimmedContext,
          priority: emptyToUndefined(state.fields.priority),
          timeHorizon: emptyToUndefined(state.fields.timeHorizon),
          details: emptyToUndefined(state.fields.details),
          // sourceDocumentId + resolved preserved by NOT including
          // them in the patch — provenance round-trip stays verbatim;
          // resolved flag is owned by the toggle path.
        });
      }
      options.onCommitted?.();
      setState({ kind: 'closed' });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setState((prev) => {
        if (prev.kind !== 'open') return prev;
        return { ...prev, submitting: false, error: detail };
      });
    }
  }, [state, profileRepo, repo, options]);

  const confirmDelete = useCallback(async () => {
    if (state.kind !== 'open' || state.mode.kind !== 'delete') return;
    setState({ ...state, submitting: true, error: null });
    try {
      await repo.delete(state.mode.point.id);
      options.onCommitted?.();
      setState({ kind: 'closed' });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setState((prev) => {
        if (prev.kind !== 'open') return prev;
        return { ...prev, submitting: false, error: detail };
      });
    }
  }, [state, repo, options]);

  const toggle = useCallback(
    async (point: OpenPoint) => {
      setTogglingId(point.id);
      setToggleError(null);
      try {
        await repo.update(point.id, { resolved: !point.resolved });
        options.onCommitted?.();
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        setToggleError(detail);
      } finally {
        setTogglingId(null);
      }
    },
    [repo, options],
  );

  return {
    state,
    openCreate,
    openEdit,
    openDelete,
    setField,
    submit,
    confirmDelete,
    close,
    toggle,
    togglingId,
    toggleError,
  };
}

function emptyToUndefined(value: string): string | undefined {
  return value.trim().length === 0 ? undefined : value;
}
