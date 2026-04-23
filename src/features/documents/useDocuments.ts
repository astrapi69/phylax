import { useEffect, useState } from 'react';
import type { Document } from '../../domain';
import { DocumentRepository, ProfileRepository } from '../../db/repositories';

export type DocumentsError = { kind: 'no-profile' } | { kind: 'generic'; detail: string };

export type DocumentsState =
  | { kind: 'loading' }
  | { kind: 'loaded'; documents: Document[] }
  | { kind: 'error'; error: DocumentsError };

export interface UseDocumentsResult {
  state: DocumentsState;
}

/**
 * Load metadata for every document on the current profile, newest first.
 *
 * Metadata only — no blob decryption. Image thumbnails are loaded
 * on-demand by the item component so the list render stays cheap
 * even with many docs. `versionKey` is a refetch trigger: bump it to
 * force a reload, e.g. after a successful upload.
 */
export function useDocuments(versionKey: number = 0): UseDocumentsResult {
  const [state, setState] = useState<DocumentsState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await new ProfileRepository().getCurrentProfile();
        if (cancelled) return;
        if (!profile) {
          setState({ kind: 'error', error: { kind: 'no-profile' } });
          return;
        }
        const repo = new DocumentRepository();
        const list = await repo.listByProfile(profile.id);
        if (cancelled) return;
        const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
        setState({ kind: 'loaded', documents: sorted });
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: 'error',
            error: {
              kind: 'generic',
              detail: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [versionKey]);

  return { state };
}
