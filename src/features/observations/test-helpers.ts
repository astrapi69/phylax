import type { Observation, Source } from '../../domain';

export function makeObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    id: 'o1',
    profileId: 'p1',
    createdAt: 1,
    updatedAt: 1,
    theme: 'Schulter',
    fact: 'Dumpfer Schmerz links nach langem Sitzen.',
    pattern: 'Tritt abends auf, verschwindet am Morgen.',
    selfRegulation: '- Mobilisation\n- Waerme',
    status: 'Chronisch-rezidivierend',
    source: 'user' satisfies Source,
    extraSections: {},
    ...overrides,
  };
}
