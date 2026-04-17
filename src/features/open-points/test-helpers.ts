import type { OpenPoint } from '../../domain';

export function makeOpenPoint(overrides: Partial<OpenPoint> = {}): OpenPoint {
  return {
    id: 'op1',
    profileId: 'p1',
    createdAt: 1,
    updatedAt: 1,
    text: 'Schulter-MRT-Ergebnis besprechen',
    context: 'Beim naechsten Arztbesuch',
    resolved: false,
    ...overrides,
  };
}
