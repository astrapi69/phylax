import { useCallback, useMemo, useState } from 'react';
import type { Observation, Source } from '../../domain';
import { ObservationRepository, ProfileRepository } from '../../db/repositories';

/**
 * Mode the form opens in. `create` starts blank with `source: 'user'`;
 * `edit` prefills from the supplied observation and preserves
 * provenance fields (`source`, `sourceDocumentId`, `extraSections`,
 * `id`, `profileId`, `createdAt`) verbatim across the round-trip.
 */
export type ObservationFormMode =
  | { kind: 'create' }
  | { kind: 'edit'; observation: Observation }
  | { kind: 'delete'; observation: Observation };

/** Field shape the form mutates locally before submit. */
export interface ObservationFormFields {
  theme: string;
  fact: string;
  pattern: string;
  selfRegulation: string;
  status: string;
  medicalFinding: string;
  relevanceNotes: string;
}

export type ObservationFormState =
  | { kind: 'closed' }
  | {
      kind: 'open';
      mode: ObservationFormMode;
      fields: ObservationFormFields;
      submitting: boolean;
      error: string | null;
      themes: readonly string[];
    };

export interface UseObservationFormOptions {
  /** Called after a successful create/update/delete write. */
  onCommitted?: () => void;
  /** Repo overrides for tests. */
  repos?: {
    profile?: ProfileRepository;
    observation?: ObservationRepository;
  };
}

export interface UseObservationFormResult {
  state: ObservationFormState;
  openCreate: () => Promise<void>;
  openEdit: (observation: Observation) => Promise<void>;
  openDelete: (observation: Observation) => void;
  setField: <K extends keyof ObservationFormFields>(
    key: K,
    value: ObservationFormFields[K],
  ) => void;
  submit: () => Promise<void>;
  confirmDelete: () => Promise<void>;
  close: () => void;
}

const EMPTY_FIELDS: ObservationFormFields = {
  theme: '',
  fact: '',
  pattern: '',
  selfRegulation: '',
  status: '',
  medicalFinding: '',
  relevanceNotes: '',
};

function fieldsFrom(observation: Observation): ObservationFormFields {
  return {
    theme: observation.theme,
    fact: observation.fact,
    pattern: observation.pattern,
    selfRegulation: observation.selfRegulation,
    status: observation.status,
    medicalFinding: observation.medicalFinding ?? '',
    relevanceNotes: observation.relevanceNotes ?? '',
  };
}

/**
 * State machine for the O-10 observation form. Drives create + edit +
 * delete. Owns the form fields locally + the theme suggestions list
 * (refreshed on every open per Q1 — newly-created themes appear next
 * time the form opens).
 *
 * Closure paths: `close` from cancel button or successful submit.
 * Submit errors keep the modal open with `error` populated; user
 * retries or cancels.
 */
export function useObservationForm(
  options: UseObservationFormOptions = {},
): UseObservationFormResult {
  const [state, setState] = useState<ObservationFormState>({ kind: 'closed' });

  // Memoized so the useCallback deps below don't churn on every render.
  // `options.repos` is the test escape hatch; production callers omit it
  // and the default repo instances stay stable across renders.
  const profileRepo = useMemo(
    () => options.repos?.profile ?? new ProfileRepository(),
    [options.repos?.profile],
  );
  const obsRepo = useMemo(
    () => options.repos?.observation ?? new ObservationRepository(),
    [options.repos?.observation],
  );

  const loadThemes = useCallback(async (): Promise<readonly string[]> => {
    const profile = await profileRepo.getCurrentProfile();
    if (!profile) return [];
    const themes = await obsRepo.listThemes(profile.id);
    const collator = new Intl.Collator('de');
    return [...themes].sort((a, b) => collator.compare(a, b));
  }, [profileRepo, obsRepo]);

  const openCreate = useCallback(async () => {
    const themes = await loadThemes();
    setState({
      kind: 'open',
      mode: { kind: 'create' },
      fields: EMPTY_FIELDS,
      submitting: false,
      error: null,
      themes,
    });
  }, [loadThemes]);

  const openEdit = useCallback(
    async (observation: Observation) => {
      const themes = await loadThemes();
      setState({
        kind: 'open',
        mode: { kind: 'edit', observation },
        fields: fieldsFrom(observation),
        submitting: false,
        error: null,
        themes,
      });
    },
    [loadThemes],
  );

  const openDelete = useCallback((observation: Observation) => {
    setState({
      kind: 'open',
      mode: { kind: 'delete', observation },
      fields: fieldsFrom(observation),
      submitting: false,
      error: null,
      themes: [],
    });
  }, []);

  const setField = useCallback<UseObservationFormResult['setField']>((key, value) => {
    setState((prev) => {
      if (prev.kind !== 'open') return prev;
      return { ...prev, fields: { ...prev.fields, [key]: value } };
    });
  }, []);

  const close = useCallback(() => setState({ kind: 'closed' }), []);

  const submit = useCallback(async () => {
    if (state.kind !== 'open') return;
    if (state.mode.kind === 'delete') return;
    const trimmedTheme = state.fields.theme.trim();
    if (trimmedTheme.length === 0) return; // theme required (validation gate)

    setState({ ...state, submitting: true, error: null });
    try {
      if (state.mode.kind === 'create') {
        const profile = await profileRepo.getCurrentProfile();
        if (!profile) throw new Error('no-profile');
        await obsRepo.create({
          profileId: profile.id,
          theme: trimmedTheme,
          fact: state.fields.fact,
          pattern: state.fields.pattern,
          selfRegulation: state.fields.selfRegulation,
          status: state.fields.status,
          source: 'user' satisfies Source,
          medicalFinding: emptyToUndefined(state.fields.medicalFinding),
          relevanceNotes: emptyToUndefined(state.fields.relevanceNotes),
          extraSections: {},
        });
      } else {
        const existing = state.mode.observation;
        await obsRepo.update(existing.id, {
          theme: trimmedTheme,
          fact: state.fields.fact,
          pattern: state.fields.pattern,
          selfRegulation: state.fields.selfRegulation,
          status: state.fields.status,
          medicalFinding: emptyToUndefined(state.fields.medicalFinding),
          relevanceNotes: emptyToUndefined(state.fields.relevanceNotes),
          // source, sourceDocumentId, extraSections preserved by NOT
          // including them in the patch (Q3: never silently downgrade
          // provenance).
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
  }, [state, profileRepo, obsRepo, options]);

  const confirmDelete = useCallback(async () => {
    if (state.kind !== 'open' || state.mode.kind !== 'delete') return;
    setState({ ...state, submitting: true, error: null });
    try {
      await obsRepo.delete(state.mode.observation.id);
      options.onCommitted?.();
      setState({ kind: 'closed' });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setState((prev) => {
        if (prev.kind !== 'open') return prev;
        return { ...prev, submitting: false, error: detail };
      });
    }
  }, [state, obsRepo, options]);

  return { state, openCreate, openEdit, openDelete, setField, submit, confirmDelete, close };
}

function emptyToUndefined(value: string): string | undefined {
  return value.trim().length === 0 ? undefined : value;
}
