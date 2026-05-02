import { useEffect, useState } from 'react';
import type { Document } from '../../domain';
import { DocumentRepository, ProfileRepository } from '../../db/repositories';

export type AttachedDocumentsState =
  | { kind: 'loading' }
  | { kind: 'loaded'; documents: Document[] }
  | { kind: 'error'; detail: string };

export interface UseAttachedDocumentsOptions {
  /** Only one of these should be passed. */
  observationId?: string;
  labValueId?: string;
  /**
   * Bump to force a refetch after a link mutation elsewhere in the
   * UI (LinkEditor save / unlink / swap kind).
   */
  versionKey?: number;
}

/**
 * Load documents linked to a given entity for the current profile.
 *
 * Thin wrapper over `DocumentRepository.listByObservation` /
 * `.listByLabValue` that additionally resolves the current profile
 * and surfaces loading / error state. Returns an empty list (not an
 * error) when nothing is linked - the caller decides whether to
 * render an empty heading or nothing at all.
 */
export function useAttachedDocuments({
  observationId,
  labValueId,
  versionKey = 0,
}: UseAttachedDocumentsOptions): AttachedDocumentsState {
  const [state, setState] = useState<AttachedDocumentsState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await new ProfileRepository().getCurrentProfile();
        if (cancelled) return;
        if (!profile) {
          setState({ kind: 'loaded', documents: [] });
          return;
        }
        const repo = new DocumentRepository();
        let docs: Document[];
        if (observationId) {
          docs = await repo.listByObservation(profile.id, observationId);
        } else if (labValueId) {
          docs = await repo.listByLabValue(profile.id, labValueId);
        } else {
          docs = [];
        }
        if (cancelled) return;
        const sorted = [...docs].sort((a, b) => b.createdAt - a.createdAt);
        setState({ kind: 'loaded', documents: sorted });
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: 'error',
            detail: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [observationId, labValueId, versionKey]);

  return state;
}
