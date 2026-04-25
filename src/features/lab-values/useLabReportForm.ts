import { useCallback, useMemo, useState } from 'react';
import type { LabReport } from '../../domain';
import { LabReportRepository, LabValueRepository, ProfileRepository } from '../../db/repositories';

/**
 * Mode the form opens in. `create` starts blank with today's date as
 * the reportDate default; `edit` prefills from the supplied report and
 * preserves provenance fields (`sourceDocumentId`, `categoryAssessments`,
 * `id`, `profileId`, `createdAt`) verbatim across the round-trip.
 */
export type LabReportFormMode =
  | { kind: 'create' }
  | { kind: 'edit'; report: LabReport }
  | { kind: 'delete'; report: LabReport; valueCount: number };

/** Field shape the form mutates locally before submit. */
export interface LabReportFormFields {
  reportDate: string;
  labName: string;
  doctorName: string;
  reportNumber: string;
  contextNote: string;
  overallAssessment: string;
  relevanceNotes: string;
}

export type LabReportFormState =
  | { kind: 'closed' }
  | {
      kind: 'open';
      mode: LabReportFormMode;
      fields: LabReportFormFields;
      submitting: boolean;
      error: string | null;
    };

export interface UseLabReportFormOptions {
  /** Called after a successful create/update/delete write. */
  onCommitted?: () => void;
  /** Repo overrides for tests. */
  repos?: {
    profile?: ProfileRepository;
    labReport?: LabReportRepository;
    labValue?: LabValueRepository;
  };
}

export interface UseLabReportFormResult {
  state: LabReportFormState;
  openCreate: () => void;
  openEdit: (report: LabReport) => void;
  openDelete: (report: LabReport) => Promise<void>;
  setField: <K extends keyof LabReportFormFields>(key: K, value: LabReportFormFields[K]) => void;
  submit: () => Promise<void>;
  confirmDelete: () => Promise<void>;
  close: () => void;
}

const EMPTY_FIELDS: LabReportFormFields = {
  reportDate: '',
  labName: '',
  doctorName: '',
  reportNumber: '',
  contextNote: '',
  overallAssessment: '',
  relevanceNotes: '',
};

function fieldsFrom(report: LabReport): LabReportFormFields {
  return {
    reportDate: report.reportDate,
    labName: report.labName ?? '',
    doctorName: report.doctorName ?? '',
    reportNumber: report.reportNumber ?? '',
    contextNote: report.contextNote ?? '',
    overallAssessment: report.overallAssessment ?? '',
    relevanceNotes: report.relevanceNotes ?? '',
  };
}

function todayIso(): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString().padStart(4, '0');
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const dd = now.getDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * State machine for the O-12a lab-report form. Drives create + edit +
 * delete. Owns the form fields locally; delete cascades through
 * `LabReportRepository.deleteWithValues`.
 *
 * Closure paths: `close` from cancel button or successful submit.
 * Submit errors keep the modal open with `error` populated; user
 * retries or cancels.
 */
export function useLabReportForm(options: UseLabReportFormOptions = {}): UseLabReportFormResult {
  const [state, setState] = useState<LabReportFormState>({ kind: 'closed' });

  const profileRepo = useMemo(
    () => options.repos?.profile ?? new ProfileRepository(),
    [options.repos?.profile],
  );
  const valueRepo = useMemo(
    () => options.repos?.labValue ?? new LabValueRepository(),
    [options.repos?.labValue],
  );
  const reportRepo = useMemo(
    () => options.repos?.labReport ?? new LabReportRepository(valueRepo),
    [options.repos?.labReport, valueRepo],
  );

  const openCreate = useCallback(() => {
    setState({
      kind: 'open',
      mode: { kind: 'create' },
      fields: { ...EMPTY_FIELDS, reportDate: todayIso() },
      submitting: false,
      error: null,
    });
  }, []);

  const openEdit = useCallback((report: LabReport) => {
    setState({
      kind: 'open',
      mode: { kind: 'edit', report },
      fields: fieldsFrom(report),
      submitting: false,
      error: null,
    });
  }, []);

  const openDelete = useCallback(
    async (report: LabReport) => {
      // Load child-value count so the cascade-confirm copy can show
      // exactly what gets deleted ("Befund vom 15.03.2026 und 12 Werte").
      let valueCount = 0;
      try {
        const values = await valueRepo.listByReport(report.id);
        valueCount = values.length;
      } catch {
        // If the value lookup fails, fall back to "and its values" copy
        // by leaving valueCount at 0; UI uses a separate i18n key for
        // the count-unknown case.
        valueCount = -1;
      }
      setState({
        kind: 'open',
        mode: { kind: 'delete', report, valueCount },
        fields: fieldsFrom(report),
        submitting: false,
        error: null,
      });
    },
    [valueRepo],
  );

  const setField = useCallback<UseLabReportFormResult['setField']>((key, value) => {
    setState((prev) => {
      if (prev.kind !== 'open') return prev;
      return { ...prev, fields: { ...prev.fields, [key]: value } };
    });
  }, []);

  const close = useCallback(() => setState({ kind: 'closed' }), []);

  const submit = useCallback(async () => {
    if (state.kind !== 'open') return;
    if (state.mode.kind === 'delete') return;
    const trimmedDate = state.fields.reportDate.trim();
    if (!isValidIsoDate(trimmedDate)) return; // validation gate

    setState({ ...state, submitting: true, error: null });
    try {
      if (state.mode.kind === 'create') {
        const profile = await profileRepo.getCurrentProfile();
        if (!profile) throw new Error('no-profile');
        await reportRepo.create({
          profileId: profile.id,
          reportDate: trimmedDate,
          labName: emptyToUndefined(state.fields.labName),
          doctorName: emptyToUndefined(state.fields.doctorName),
          reportNumber: emptyToUndefined(state.fields.reportNumber),
          contextNote: emptyToUndefined(state.fields.contextNote),
          categoryAssessments: {},
          overallAssessment: emptyToUndefined(state.fields.overallAssessment),
          relevanceNotes: emptyToUndefined(state.fields.relevanceNotes),
        });
      } else {
        const existing = state.mode.report;
        await reportRepo.update(existing.id, {
          reportDate: trimmedDate,
          labName: emptyToUndefined(state.fields.labName),
          doctorName: emptyToUndefined(state.fields.doctorName),
          reportNumber: emptyToUndefined(state.fields.reportNumber),
          contextNote: emptyToUndefined(state.fields.contextNote),
          overallAssessment: emptyToUndefined(state.fields.overallAssessment),
          relevanceNotes: emptyToUndefined(state.fields.relevanceNotes),
          // sourceDocumentId + categoryAssessments preserved by NOT
          // including them in the patch (Q3: never silently downgrade
          // provenance or drop AI-extracted per-category assessments).
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
  }, [state, profileRepo, reportRepo, options]);

  const confirmDelete = useCallback(async () => {
    if (state.kind !== 'open' || state.mode.kind !== 'delete') return;
    setState({ ...state, submitting: true, error: null });
    try {
      await reportRepo.deleteWithValues(state.mode.report.id);
      options.onCommitted?.();
      setState({ kind: 'closed' });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setState((prev) => {
        if (prev.kind !== 'open') return prev;
        return { ...prev, submitting: false, error: detail };
      });
    }
  }, [state, reportRepo, options]);

  return { state, openCreate, openEdit, openDelete, setField, submit, confirmDelete, close };
}

function emptyToUndefined(value: string): string | undefined {
  return value.trim().length === 0 ? undefined : value;
}

/** Strict ISO YYYY-MM-DD with a real-calendar parse check. */
function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  // Reject dates that get coerced (e.g. 2026-02-31 -> 2026-03-03).
  return parsed.toISOString().slice(0, 10) === value;
}
