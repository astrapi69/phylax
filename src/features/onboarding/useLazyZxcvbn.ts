import { useCallback, useEffect, useRef, useState } from 'react';

type ZxcvbnScorer = (password: string) => number;

/**
 * Lazy-loads @zxcvbn-ts on mount. Keeps the main bundle free of the
 * library + dictionaries while giving the setup flow realistic
 * strength scoring.
 *
 * Only the `@zxcvbn-ts/language-common` pack is loaded (passwords,
 * diceware wordlist, keyboard adjacency graphs). Language-specific
 * packs (`language-en`, `language-de`) weigh in at around 560 KB and
 * 365 KB gzipped respectively and primarily add name + wikipedia
 * dictionaries. The common pack covers the dominant signal: detection
 * of passwords on the leaked-password lists. ADR-0014 documents the
 * scope decision.
 *
 * Returns a synchronous scorer once ready; consumers fall back to the
 * sync heuristic estimator while `ready` is false or if `error` is
 * non-null.
 */
export interface LazyZxcvbnHook {
  ready: boolean;
  error: unknown;
  score: ZxcvbnScorer | undefined;
}

export function useLazyZxcvbn(): LazyZxcvbnHook {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const scorerRef = useRef<ZxcvbnScorer | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [core, common] = await Promise.all([
          import('@zxcvbn-ts/core'),
          import('@zxcvbn-ts/language-common'),
        ]);

        if (cancelled) return;

        core.zxcvbnOptions.setOptions({
          dictionary: common.dictionary,
          graphs: common.adjacencyGraphs,
        });

        scorerRef.current = (password: string) => core.zxcvbn(password).score;
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        console.error('[useLazyZxcvbn] failed to load zxcvbn-ts', err);
        setError(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const score = useCallback<ZxcvbnScorer>((password: string) => {
    const fn = scorerRef.current;
    if (!fn) return 0;
    return fn(password);
  }, []);

  return { ready, error, score: ready ? score : undefined };
}
