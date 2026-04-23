import { useEffect, useState } from 'react';
import type { Document } from '../../domain';
import { DocumentRepository } from '../../db/repositories';

export type DocumentContentState =
  | { kind: 'loading' }
  | { kind: 'ready'; url: string; document: Document }
  | { kind: 'not-found' }
  | { kind: 'decrypt-failed'; detail: string };

/**
 * Load + decrypt a document for a viewer component.
 *
 * Fetches metadata and blob, wraps the decrypted bytes in a
 * `Blob(mimeType)` and exposes the resulting `URL.createObjectURL`
 * so the viewer can drop it straight into `<iframe src>` or
 * `<img src>`.
 *
 * Lifetime guarantees:
 * - Every object URL created here is revoked when the effect tears
 *   down: unmount OR the `id` argument changes OR the effect is
 *   re-run under React strict-mode double-invoke.
 * - A cancelled-mid-flight decrypt (id changed or component unmounted
 *   before `getContent` resolved) will not leak an object URL: the
 *   cleanup runs first, and the stale promise short-circuits on
 *   `cancelled`.
 *
 * Error states:
 * - `not-found`: metadata row missing, or metadata present but blob
 *   row missing (orphan). Either way the viewer cannot render.
 * - `decrypt-failed`: keystore locked, tampered ciphertext, or any
 *   other error from the repository. Detail is preserved for
 *   diagnostics but the UI only surfaces a localized generic message.
 */
export function useDocumentContent(id: string, reloadKey: number = 0): DocumentContentState {
  const [state, setState] = useState<DocumentContentState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    setState({ kind: 'loading' });

    (async () => {
      try {
        const repo = new DocumentRepository();
        const metadata = await repo.getMetadata(id);
        if (cancelled) return;
        if (!metadata) {
          setState({ kind: 'not-found' });
          return;
        }
        const content = await repo.getContent(id);
        if (cancelled) return;
        if (!content) {
          setState({ kind: 'not-found' });
          return;
        }
        const blob = new Blob([content], { type: metadata.mimeType });
        const url = URL.createObjectURL(blob);
        createdUrl = url;
        setState({ kind: 'ready', url, document: metadata });
      } catch (err) {
        if (!cancelled) {
          setState({
            kind: 'decrypt-failed',
            detail: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [id, reloadKey]);

  return state;
}
