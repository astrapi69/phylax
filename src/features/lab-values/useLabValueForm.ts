import { useCallback, useMemo, useState } from 'react';
import type { LabValue } from '../../domain';
import { LabValueRepository, ProfileRepository } from '../../db/repositories';

/**
 * Mode the form opens in. `create` carries the parent `reportId` so a
 * single hook instance at the view level can drive add-from-any-card
 * without per-card wiring; `edit` and `delete` carry the existing
 * `LabValue` so provenance fields (`sourceDocumentId`, `id`,
 * `profileId`, `createdAt`, `reportId`) round-trip verbatim.
 */
export type LabValueFormMode =
  | { kind: 'create'; reportId: string }
  | { kind: 'edit'; value: LabValue }
  | { kind: 'delete'; value: LabValue };

/** Field shape the form mutates locally before submit. */
export interface LabValueFormFields {
  category: string;
  parameter: string;
  result: string;
  unit: string;
  referenceRange: string;
  assessment: string;
}

export type LabValueFormState =
  | { kind: 'closed' }
  | {
      kind: 'open';
      mode: LabValueFormMode;
      fields: LabValueFormFields;
      submitting: boolean;
      error: string | null;
      /** Profile-wide parameter suggestions, German-collated. */
      parameters: readonly string[];
      /** Categories already present in the active report. */
      categories: readonly string[];
    };

export interface UseLabValueFormOptions {
  /** Called after a successful create/update/delete write. */
  onCommitted?: () => void;
  /** Repo overrides for tests. */
  repos?: {
    profile?: ProfileRepository;
    labValue?: LabValueRepository;
  };
}

export interface UseLabValueFormResult {
  state: LabValueFormState;
  openCreate: (reportId: string) => Promise<void>;
  openEdit: (value: LabValue) => Promise<void>;
  openDelete: (value: LabValue) => void;
  setField: <K extends keyof LabValueFormFields>(key: K, value: LabValueFormFields[K]) => void;
  submit: () => Promise<void>;
  confirmDelete: () => Promise<void>;
  close: () => void;
}

const EMPTY_FIELDS: LabValueFormFields = {
  category: '',
  parameter: '',
  result: '',
  unit: '',
  referenceRange: '',
  assessment: '',
};

function fieldsFrom(value: LabValue): LabValueFormFields {
  return {
    category: value.category,
    parameter: value.parameter,
    result: value.result,
    unit: value.unit ?? '',
    referenceRange: value.referenceRange ?? '',
    assessment: value.assessment ?? '',
  };
}

/**
 * State machine for the O-12b lab-value form. Drives create + edit +
 * delete. Owns the form fields locally and refreshes parameter +
 * category suggestions on every open so newly-entered names appear
 * next time the form opens (mirrors `useObservationForm.loadThemes`).
 *
 * Closure paths: `close` from cancel button or successful submit.
 * Submit errors keep the modal open with `error` populated; user
 * retries or cancels.
 *
 * Re-categorization: edit mode allows changing `category`; the table
 * re-groups on save through the `onCommitted` refetch.
 */
export function useLabValueForm(options: UseLabValueFormOptions = {}): UseLabValueFormResult {
  const [state, setState] = useState<LabValueFormState>({ kind: 'closed' });

  const profileRepo = useMemo(
    () => options.repos?.profile ?? new ProfileRepository(),
    [options.repos?.profile],
  );
  const valueRepo = useMemo(
    () => options.repos?.labValue ?? new LabValueRepository(),
    [options.repos?.labValue],
  );

  const loadParameters = useCallback(async (): Promise<readonly string[]> => {
    const profile = await profileRepo.getCurrentProfile();
    if (!profile) return [];
    const params = await valueRepo.listParameters(profile.id);
    const collator = new Intl.Collator('de');
    return [...params].sort((a, b) => collator.compare(a, b));
  }, [profileRepo, valueRepo]);

  const loadCategoriesForReport = useCallback(
    async (reportId: string): Promise<readonly string[]> => {
      const values = await valueRepo.listByReport(reportId);
      const unique = [...new Set(values.map((v) => v.category))];
      const collator = new Intl.Collator('de');
      return unique.sort((a, b) => collator.compare(a, b));
    },
    [valueRepo],
  );

  const openCreate = useCallback(
    async (reportId: string) => {
      const [parameters, categories] = await Promise.all([
        loadParameters(),
        loadCategoriesForReport(reportId),
      ]);
      setState({
        kind: 'open',
        mode: { kind: 'create', reportId },
        fields: EMPTY_FIELDS,
        submitting: false,
        error: null,
        parameters,
        categories,
      });
    },
    [loadParameters, loadCategoriesForReport],
  );

  const openEdit = useCallback(
    async (value: LabValue) => {
      const [parameters, categories] = await Promise.all([
        loadParameters(),
        loadCategoriesForReport(value.reportId),
      ]);
      setState({
        kind: 'open',
        mode: { kind: 'edit', value },
        fields: fieldsFrom(value),
        submitting: false,
        error: null,
        parameters,
        categories,
      });
    },
    [loadParameters, loadCategoriesForReport],
  );

  const openDelete = useCallback((value: LabValue) => {
    setState({
      kind: 'open',
      mode: { kind: 'delete', value },
      fields: fieldsFrom(value),
      submitting: false,
      error: null,
      parameters: [],
      categories: [],
    });
  }, []);

  const setField = useCallback<UseLabValueFormResult['setField']>((key, value) => {
    setState((prev) => {
      if (prev.kind !== 'open') return prev;
      return { ...prev, fields: { ...prev.fields, [key]: value } };
    });
  }, []);

  const close = useCallback(() => setState({ kind: 'closed' }), []);

  const submit = useCallback(async () => {
    if (state.kind !== 'open') return;
    if (state.mode.kind === 'delete') return;

    const trimmedCategory = state.fields.category.trim();
    const trimmedParameter = state.fields.parameter.trim();
    const trimmedResult = state.fields.result.trim();
    if (
      trimmedCategory.length === 0 ||
      trimmedParameter.length === 0 ||
      trimmedResult.length === 0
    ) {
      return; // validation gate
    }

    setState({ ...state, submitting: true, error: null });
    try {
      if (state.mode.kind === 'create') {
        const profile = await profileRepo.getCurrentProfile();
        if (!profile) throw new Error('no-profile');
        await valueRepo.create({
          profileId: profile.id,
          reportId: state.mode.reportId,
          category: trimmedCategory,
          parameter: trimmedParameter,
          result: trimmedResult,
          unit: emptyToUndefined(state.fields.unit),
          referenceRange: emptyToUndefined(state.fields.referenceRange),
          assessment: emptyToUndefined(state.fields.assessment),
        });
      } else {
        const existing = state.mode.value;
        await valueRepo.update(existing.id, {
          category: trimmedCategory,
          parameter: trimmedParameter,
          result: trimmedResult,
          unit: emptyToUndefined(state.fields.unit),
          referenceRange: emptyToUndefined(state.fields.referenceRange),
          assessment: emptyToUndefined(state.fields.assessment),
          // sourceDocumentId + reportId preserved by NOT including them
          // in the patch — provenance round-trip and parent FK stay
          // verbatim. reportId is immutable from the form's perspective
          // even though the base class does not enforce it.
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
  }, [state, profileRepo, valueRepo, options]);

  const confirmDelete = useCallback(async () => {
    if (state.kind !== 'open' || state.mode.kind !== 'delete') return;
    setState({ ...state, submitting: true, error: null });
    try {
      await valueRepo.delete(state.mode.value.id);
      options.onCommitted?.();
      setState({ kind: 'closed' });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setState((prev) => {
        if (prev.kind !== 'open') return prev;
        return { ...prev, submitting: false, error: detail };
      });
    }
  }, [state, valueRepo, options]);

  return { state, openCreate, openEdit, openDelete, setField, submit, confirmDelete, close };
}

function emptyToUndefined(value: string): string | undefined {
  return value.trim().length === 0 ? undefined : value;
}
