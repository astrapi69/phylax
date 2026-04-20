import { useState, useCallback } from 'react';
import { ProfileRepository } from '../../db/repositories/profileRepository';

export interface ProfileCreateState {
  kind: 'idle' | 'submitting' | 'done' | 'error';
  profileId?: string;
  detail?: string;
}

export interface ProfileCreateHook {
  state: ProfileCreateState;
  name: string;
  profileType: 'self' | 'proxy';
  managedBy: string;
  version: string;
  setName: (v: string) => void;
  setProfileType: (v: 'self' | 'proxy') => void;
  setManagedBy: (v: string) => void;
  setVersion: (v: string) => void;
  isValid: boolean;
  submit: () => Promise<void>;
}

/**
 * Hook for profile creation form state, validation, and submission.
 *
 * On submit, creates a Profile via ProfileRepository with minimal BaseData.
 * Fields not captured in this form (diagnoses, medications, etc.) start empty
 * and are filled later via profile editing or import.
 *
 * @param onComplete - called with the new profileId after successful creation
 */
export function useProfileCreate(onComplete: (profileId: string) => void): ProfileCreateHook {
  const [state, setState] = useState<ProfileCreateState>({ kind: 'idle' });
  const [name, setName] = useState('');
  const [profileType, setProfileType] = useState<'self' | 'proxy'>('self');
  const [managedBy, setManagedBy] = useState('');
  const [version, setVersion] = useState('1.0');

  const isValid = name.trim().length > 0 && (profileType === 'self' || managedBy.trim().length > 0);

  const submit = useCallback(async () => {
    if (!isValid || state.kind === 'submitting') return;

    setState({ kind: 'submitting' });

    try {
      const repo = new ProfileRepository();
      const profile = await repo.create({
        baseData: {
          name: name.trim(),
          weightHistory: [],
          knownDiagnoses: [],
          currentMedications: [],
          relevantLimitations: [],
          profileType,
          managedBy: profileType === 'proxy' ? managedBy.trim() : undefined,
          contextNotes: undefined,
        },
        warningSigns: [],
        externalReferences: [],
        version: version.trim() || '1.0',
      });

      setState({ kind: 'done', profileId: profile.id });
      onComplete(profile.id);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setState({ kind: 'error', detail });
    }
  }, [isValid, state.kind, name, profileType, managedBy, version, onComplete]);

  return {
    state,
    name,
    profileType,
    managedBy,
    version,
    setName,
    setProfileType,
    setManagedBy,
    setVersion,
    isValid,
    submit,
  };
}
