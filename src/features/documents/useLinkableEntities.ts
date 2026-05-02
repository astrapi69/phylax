import { useEffect, useState } from 'react';
import type { Observation, LabValue } from '../../domain';
import {
  ObservationRepository,
  LabValueRepository,
  ProfileRepository,
} from '../../db/repositories';

export interface LinkableObservation {
  id: string;
  label: string;
}

export interface LinkableLabValue {
  id: string;
  label: string;
}

export type LinkableEntitiesState =
  | { kind: 'loading' }
  | { kind: 'loaded'; observations: LinkableObservation[]; labValues: LinkableLabValue[] }
  | { kind: 'error'; detail: string };

/**
 * Load observations + lab values for the link picker, formatted as
 * `{ id, label }` pairs ready for a `<select>`.
 *
 * Display order: newest first (reverse chronological). The most
 * common picker target is the entity the user just created or
 * recently edited; newest-first minimizes scroll distance.
 *
 * Observation labels: theme + first 40 chars of `fact`.
 * Lab-value labels: "<parameter> (<reportDate>) - <result><unit>".
 */
export function useLinkableEntities(): LinkableEntitiesState {
  const [state, setState] = useState<LinkableEntitiesState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await new ProfileRepository().getCurrentProfile();
        if (cancelled) return;
        if (!profile) {
          setState({ kind: 'loaded', observations: [], labValues: [] });
          return;
        }
        const [obs, labValues] = await Promise.all([
          new ObservationRepository().listByProfileChronological(profile.id),
          new LabValueRepository().listByProfile(profile.id),
        ]);
        if (cancelled) return;

        const obsSorted = [...obs].sort((a, b) => b.createdAt - a.createdAt);
        const observations: LinkableObservation[] = obsSorted.map((o) => ({
          id: o.id,
          label: formatObservationLabel(o),
        }));

        const labSorted = [...labValues].sort((a, b) => b.createdAt - a.createdAt);
        const labValuesFormatted: LinkableLabValue[] = labSorted.map((v) => ({
          id: v.id,
          label: formatLabValueLabel(v),
        }));

        setState({
          kind: 'loaded',
          observations,
          labValues: labValuesFormatted,
        });
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
  }, []);

  return state;
}

function formatObservationLabel(o: Observation): string {
  const fact = o.fact ? firstLineTruncated(o.fact, 40) : '';
  return fact ? `${o.theme} - ${fact}` : o.theme;
}

function formatLabValueLabel(v: LabValue): string {
  const result = v.unit ? `${v.result} ${v.unit}` : v.result;
  return `${v.parameter} - ${result}`;
}

function firstLineTruncated(text: string, max: number): string {
  const first = text.split('\n')[0]?.trim() ?? '';
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
}
