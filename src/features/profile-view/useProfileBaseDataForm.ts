import { useCallback, useMemo, useState } from 'react';
import type { Profile, ProfileVersion } from '../../domain';
import { ProfileRepository, ProfileVersionRepository } from '../../db/repositories';
import { generateId } from '../../crypto';
import { db } from '../../db/schema';
import { bumpVersion } from '../../domain/profileVersion/bumpVersion';

/**
 * Mode the form opens in. Only `edit` exists for the base-data form
 * (profile is single-instance per ADR; create + delete don't apply).
 */
export type ProfileBaseDataFormMode = { kind: 'edit'; profile: Profile };

/** Field shape the form mutates locally before submit. */
export interface ProfileBaseDataFormFields {
  name: string;
  birthDate: string;
  knownDiagnoses: string[];
  currentMedications: string[];
  relevantLimitations: string[];
  lastUpdateReason: string;
}

export type ProfileBaseDataFormState =
  | { kind: 'closed' }
  | {
      kind: 'open';
      mode: ProfileBaseDataFormMode;
      fields: ProfileBaseDataFormFields;
      submitting: boolean;
      error: string | null;
    };

export interface UseProfileBaseDataFormOptions {
  /** Called after a successful update so the parent view refetches. */
  onCommitted?: () => void;
  /** Repo overrides for tests. */
  repos?: {
    profile?: ProfileRepository;
    profileVersion?: ProfileVersionRepository;
  };
}

export interface UseProfileBaseDataFormResult {
  state: ProfileBaseDataFormState;
  openEdit: (profile: Profile) => void;
  setField: <K extends keyof ProfileBaseDataFormFields>(
    key: K,
    value: ProfileBaseDataFormFields[K],
  ) => void;
  submit: () => Promise<void>;
  close: () => void;
}

const FALLBACK_REASON = 'Manuelle Bearbeitung';

function fieldsFrom(profile: Profile): ProfileBaseDataFormFields {
  return {
    name: profile.baseData.name ?? '',
    birthDate: profile.baseData.birthDate ?? '',
    knownDiagnoses: [...profile.baseData.knownDiagnoses],
    currentMedications: [...profile.baseData.currentMedications],
    relevantLimitations: [...profile.baseData.relevantLimitations],
    lastUpdateReason: '',
  };
}

function trimAndDropEmpty(values: string[]): string[] {
  return values.map((v) => v.trim()).filter((v) => v.length > 0);
}

function todayIso(now = Date.now()): string {
  const d = new Date(now);
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isValidIsoDate(value: string): boolean {
  if (value.length === 0) return true; // empty allowed (optional field)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/**
 * State machine for the O-16 profile base-data edit form. Drives a
 * single edit mode (no create / no delete - Phylax is single-profile
 * per ADR; the profile already exists).
 *
 * Save side effects, in a single Dexie transaction (atomicity matches
 * the AI-chat commit pattern in `commitFragment`):
 * 1. Profile.baseData fields updated from the form.
 * 2. Profile.version bumped via `bumpVersion()` (1.3.1 → 1.3.2).
 * 3. Profile.lastUpdateReason set to the form's reason or fallback
 *    "Manuelle Bearbeitung" when empty.
 * 4. New ProfileVersion row created with the bumped version,
 *    changeDescription = lastUpdateReason, changeDate = today's ISO.
 *
 * Q4 migration (legacy age-without-birthDate): if the existing profile
 * has `age` set but no `birthDate`, the form lets the user enter a
 * birthDate. On save with a birthDate set, `age` is cleared
 * (single source of truth going forward - age is derived from
 * birthDate). If birthDate stays empty, age stays untouched.
 *
 * Provenance: Profile entity has no `sourceDocumentId` (IMP-05 lives
 * on individual children). Edit-mode patch preserves all baseData
 * fields not present in the form (heightCm, weightKg, weightHistory,
 * primaryDoctor, contextNotes, profileType, managedBy) verbatim by
 * spreading the existing baseData and overriding only the form's
 * fields. Out-of-scope fields are not mutated.
 *
 * Closure paths: `close` from cancel button or successful submit.
 * Submit errors keep the modal open with `error` populated; user
 * retries or cancels.
 */
export function useProfileBaseDataForm(
  options: UseProfileBaseDataFormOptions = {},
): UseProfileBaseDataFormResult {
  const [state, setState] = useState<ProfileBaseDataFormState>({ kind: 'closed' });

  const profileRepo = useMemo(
    () => options.repos?.profile ?? new ProfileRepository(),
    [options.repos?.profile],
  );
  const versionRepo = useMemo(
    () => options.repos?.profileVersion ?? new ProfileVersionRepository(),
    [options.repos?.profileVersion],
  );

  const openEdit = useCallback((profile: Profile) => {
    setState({
      kind: 'open',
      mode: { kind: 'edit', profile },
      fields: fieldsFrom(profile),
      submitting: false,
      error: null,
    });
  }, []);

  const setField = useCallback<UseProfileBaseDataFormResult['setField']>((key, value) => {
    setState((prev) => {
      if (prev.kind !== 'open') return prev;
      return { ...prev, fields: { ...prev.fields, [key]: value } };
    });
  }, []);

  const close = useCallback(() => setState({ kind: 'closed' }), []);

  const submit = useCallback(async () => {
    if (state.kind !== 'open') return;

    const trimmedName = state.fields.name.trim();
    if (trimmedName.length === 0) return; // name required (validation gate)
    if (!isValidIsoDate(state.fields.birthDate)) return;

    setState({ ...state, submitting: true, error: null });
    try {
      const existing = state.mode.profile;
      const now = Date.now();
      const newVersion = bumpVersion(existing.version);
      const reason =
        state.fields.lastUpdateReason.trim().length > 0
          ? state.fields.lastUpdateReason.trim()
          : FALLBACK_REASON;
      const newBirthDate = state.fields.birthDate.length > 0 ? state.fields.birthDate : undefined;

      // Q4 migration: if user provided a birthDate, clear the legacy
      // `age` field so birthDate becomes the single source of truth.
      // If birthDate stays empty, age stays untouched.
      const newAge = newBirthDate !== undefined ? undefined : existing.baseData.age;

      const updatedProfile: Profile = {
        ...existing,
        baseData: {
          ...existing.baseData,
          name: trimmedName,
          birthDate: newBirthDate,
          age: newAge,
          knownDiagnoses: trimAndDropEmpty(state.fields.knownDiagnoses),
          currentMedications: trimAndDropEmpty(state.fields.currentMedications),
          relevantLimitations: trimAndDropEmpty(state.fields.relevantLimitations),
        },
        version: newVersion,
        lastUpdateReason: reason,
        updatedAt: now,
      };

      const versionEntity: ProfileVersion = {
        id: generateId(),
        profileId: existing.id,
        createdAt: now,
        updatedAt: now,
        version: newVersion,
        changeDescription: reason,
        changeDate: todayIso(now),
      };

      // Pre-encrypt before opening the transaction. Crypto inside a
      // Dexie transaction triggers PrematureCommitError (same lesson
      // as commitFragment + populateVault).
      const profileRow = await profileRepo.serialize(updatedProfile);
      const versionRow = await versionRepo.serialize(versionEntity);

      await db.transaction('rw', [db.profiles, db.profileVersions], async () => {
        await Promise.all([db.profiles.put(profileRow), db.profileVersions.put(versionRow)]);
      });

      options.onCommitted?.();
      setState({ kind: 'closed' });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setState((prev) => {
        if (prev.kind !== 'open') return prev;
        return { ...prev, submitting: false, error: detail };
      });
    }
  }, [state, profileRepo, versionRepo, options]);

  return { state, openEdit, setField, submit, close };
}
