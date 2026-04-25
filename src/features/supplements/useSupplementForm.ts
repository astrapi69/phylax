import { useCallback, useMemo, useState } from 'react';
import type { Supplement, SupplementCategory } from '../../domain';
import { ProfileRepository, SupplementRepository } from '../../db/repositories';

/**
 * Mode the form opens in. `create` starts blank with empty `category`
 * (placeholder option, non-submittable); `edit` prefills from the
 * supplied supplement and preserves provenance fields
 * (`sourceDocumentId`, `id`, `profileId`, `createdAt`) verbatim across
 * the round-trip.
 */
export type SupplementFormMode =
  | { kind: 'create' }
  | { kind: 'edit'; supplement: Supplement }
  | { kind: 'delete'; supplement: Supplement };

/**
 * Field shape the form mutates locally before submit. `category` is
 * widened to `SupplementCategory | ''` so an empty placeholder option
 * can drive the gating; submit refuses while `category === ''`.
 */
export interface SupplementFormFields {
  name: string;
  brand: string;
  category: SupplementCategory | '';
  recommendation: string;
  rationale: string;
}

export type SupplementFormState =
  | { kind: 'closed' }
  | {
      kind: 'open';
      mode: SupplementFormMode;
      fields: SupplementFormFields;
      submitting: boolean;
      error: string | null;
    };

export interface UseSupplementFormOptions {
  /** Called after a successful create/update/delete write. */
  onCommitted?: () => void;
  /** Repo overrides for tests. */
  repos?: {
    profile?: ProfileRepository;
    supplement?: SupplementRepository;
  };
}

export interface UseSupplementFormResult {
  state: SupplementFormState;
  openCreate: () => void;
  openEdit: (supplement: Supplement) => void;
  openDelete: (supplement: Supplement) => void;
  setField: <K extends keyof SupplementFormFields>(key: K, value: SupplementFormFields[K]) => void;
  submit: () => Promise<void>;
  confirmDelete: () => Promise<void>;
  close: () => void;
}

const EMPTY_FIELDS: SupplementFormFields = {
  name: '',
  brand: '',
  category: '',
  recommendation: '',
  rationale: '',
};

function fieldsFrom(supplement: Supplement): SupplementFormFields {
  return {
    name: supplement.name,
    brand: supplement.brand ?? '',
    category: supplement.category,
    recommendation: supplement.recommendation ?? '',
    rationale: supplement.rationale ?? '',
  };
}

/**
 * State machine for the O-14 supplement form. Drives create + edit +
 * delete. Owns form fields locally; no datalists (closed enum for
 * `category` via `<select>`, free text for the rest — no useful
 * profile-wide suggestion sets per Q4 of the locked plan).
 *
 * Closure paths: `close` from cancel button or successful submit.
 * Submit errors keep the modal open with `error` populated; user
 * retries or cancels.
 *
 * Re-categorization: edit mode allows changing `category`; the parent
 * groups reshuffle through the `onCommitted` refetch.
 */
export function useSupplementForm(options: UseSupplementFormOptions = {}): UseSupplementFormResult {
  const [state, setState] = useState<SupplementFormState>({ kind: 'closed' });

  const profileRepo = useMemo(
    () => options.repos?.profile ?? new ProfileRepository(),
    [options.repos?.profile],
  );
  const repo = useMemo(
    () => options.repos?.supplement ?? new SupplementRepository(),
    [options.repos?.supplement],
  );

  const openCreate = useCallback(() => {
    setState({
      kind: 'open',
      mode: { kind: 'create' },
      fields: EMPTY_FIELDS,
      submitting: false,
      error: null,
    });
  }, []);

  const openEdit = useCallback((supplement: Supplement) => {
    setState({
      kind: 'open',
      mode: { kind: 'edit', supplement },
      fields: fieldsFrom(supplement),
      submitting: false,
      error: null,
    });
  }, []);

  const openDelete = useCallback((supplement: Supplement) => {
    setState({
      kind: 'open',
      mode: { kind: 'delete', supplement },
      fields: fieldsFrom(supplement),
      submitting: false,
      error: null,
    });
  }, []);

  const setField = useCallback<UseSupplementFormResult['setField']>((key, value) => {
    setState((prev) => {
      if (prev.kind !== 'open') return prev;
      return { ...prev, fields: { ...prev.fields, [key]: value } };
    });
  }, []);

  const close = useCallback(() => setState({ kind: 'closed' }), []);

  const submit = useCallback(async () => {
    if (state.kind !== 'open') return;
    if (state.mode.kind === 'delete') return;

    const trimmedName = state.fields.name.trim();
    const category = state.fields.category;
    if (trimmedName.length === 0 || category === '') {
      return; // validation gate
    }

    setState({ ...state, submitting: true, error: null });
    try {
      if (state.mode.kind === 'create') {
        const profile = await profileRepo.getCurrentProfile();
        if (!profile) throw new Error('no-profile');
        await repo.create({
          profileId: profile.id,
          name: trimmedName,
          brand: emptyToUndefined(state.fields.brand),
          category,
          recommendation: emptyToUndefined(state.fields.recommendation),
          rationale: emptyToUndefined(state.fields.rationale),
        });
      } else {
        const existing = state.mode.supplement;
        await repo.update(existing.id, {
          name: trimmedName,
          brand: emptyToUndefined(state.fields.brand),
          category,
          recommendation: emptyToUndefined(state.fields.recommendation),
          rationale: emptyToUndefined(state.fields.rationale),
          // sourceDocumentId preserved by NOT including it in the
          // patch — provenance round-trip stays verbatim.
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
      await repo.delete(state.mode.supplement.id);
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

  return { state, openCreate, openEdit, openDelete, setField, submit, confirmDelete, close };
}

function emptyToUndefined(value: string): string | undefined {
  return value.trim().length === 0 ? undefined : value;
}
