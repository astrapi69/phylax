import { describe, it, expect } from 'vitest';
import type { ParseResult } from '../parser/types';
import { isEmptyParseResult, shouldOfferCleanup, totalEntityCount } from './parseFailureDetection';

function emptyResult(): ParseResult {
  return {
    profile: null,
    observations: [],
    labReports: [],
    labValues: [],
    supplements: [],
    openPoints: [],
    profileVersions: [],
    timelineEntries: [],
    report: { recognized: [], warnings: [], unrecognized: [], metadata: {} },
    originalMarkdown: '',
  };
}

function resultWith(
  parts: Partial<{
    observations: number;
    supplements: number;
    openPoints: number;
    warnings: number;
    infoNotices: number;
    hasProfile: boolean;
  }>,
): ParseResult {
  const r = emptyResult();
  r.observations = Array.from({ length: parts.observations ?? 0 }, () => ({}) as never);
  r.supplements = Array.from({ length: parts.supplements ?? 0 }, () => ({}) as never);
  r.openPoints = Array.from({ length: parts.openPoints ?? 0 }, () => ({}) as never);
  const warnings = Array.from({ length: parts.warnings ?? 0 }, (_, i) => ({
    section: `s${i}`,
    severity: 'warning' as const,
    message: `w${i}`,
  }));
  const infos = Array.from({ length: parts.infoNotices ?? 0 }, (_, i) => ({
    section: `i${i}`,
    severity: 'info' as const,
    message: `info ${i}`,
  }));
  r.report.warnings = [...warnings, ...infos];
  if (parts.hasProfile) {
    r.profile = {} as ParseResult['profile'];
  }
  return r;
}

describe('totalEntityCount', () => {
  it('sums entities across all entity types', () => {
    const r = resultWith({ observations: 2, supplements: 3, openPoints: 1 });
    expect(totalEntityCount(r)).toBe(6);
  });
});

describe('isEmptyParseResult', () => {
  it('true when profile is null and no entities exist', () => {
    expect(isEmptyParseResult(emptyResult())).toBe(true);
  });

  it('false when a profile is present, even with no entities', () => {
    expect(isEmptyParseResult(resultWith({ hasProfile: true }))).toBe(false);
  });

  it('false when any entity list is non-empty', () => {
    expect(isEmptyParseResult(resultWith({ observations: 1 }))).toBe(false);
  });
});

describe('shouldOfferCleanup', () => {
  it('true for empty results (hard failure)', () => {
    expect(shouldOfferCleanup(emptyResult())).toBe(true);
  });

  it('true for low-entity result with warnings (soft failure)', () => {
    expect(shouldOfferCleanup(resultWith({ observations: 2, warnings: 1 }))).toBe(true);
  });

  it('false for low-entity result without warnings (short but valid)', () => {
    expect(shouldOfferCleanup(resultWith({ observations: 2 }))).toBe(false);
  });

  it('false when the entity count meets the threshold, even with warnings', () => {
    expect(shouldOfferCleanup(resultWith({ observations: 3, warnings: 5 }))).toBe(false);
  });

  it('false for a healthy import with many entities and warnings', () => {
    expect(
      shouldOfferCleanup(
        resultWith({ observations: 10, supplements: 4, openPoints: 6, warnings: 2 }),
      ),
    ).toBe(false);
  });

  it('false for low-entity result with only info-level notices (empty placeholders are benign)', () => {
    expect(shouldOfferCleanup(resultWith({ observations: 2, infoNotices: 6 }))).toBe(false);
  });
});
