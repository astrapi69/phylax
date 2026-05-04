import { describe, it, expect } from 'vitest';
import type { Document, LabReport, LabValue, Observation } from '../../domain';
import { classifyMime, formatBytes, pickLinkedDocuments, resolveLinkTargets } from './appendix';

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: 'doc-1',
    profileId: 'p1',
    createdAt: 1,
    updatedAt: 1,
    filename: 'lab.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    payloadKey: 'k',
    ...overrides,
  } as Document;
}

describe('pickLinkedDocuments', () => {
  it('keeps documents linked to an observation', () => {
    const linked = makeDoc({ linkedObservationId: 'o1' });
    const unlinked = makeDoc({ id: 'doc-2' });
    expect(pickLinkedDocuments([linked, unlinked])).toEqual([linked]);
  });

  it('keeps documents linked to a lab value', () => {
    const linked = makeDoc({ linkedLabValueId: 'lv1' });
    expect(pickLinkedDocuments([linked])).toEqual([linked]);
  });

  it('drops documents with no link fields', () => {
    expect(pickLinkedDocuments([makeDoc()])).toEqual([]);
  });
});

describe('formatBytes', () => {
  it('renders byte units below 1024', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('renders KB units between 1024 and 1024*1024', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1023)).toBe('1023.0 KB');
  });

  it('renders MB units at and above 1024*1024 (line 34)', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
    expect(formatBytes(20 * 1024 * 1024)).toBe('20.0 MB');
  });
});

describe('classifyMime', () => {
  it('returns pdf for application/pdf', () => {
    expect(classifyMime('application/pdf')).toBe('pdf');
  });

  it('returns image for image/* (line 41)', () => {
    expect(classifyMime('image/png')).toBe('image');
    expect(classifyMime('image/jpeg')).toBe('image');
    expect(classifyMime('image/heic')).toBe('image');
  });

  it('returns other for any non-pdf, non-image mime (line 42)', () => {
    expect(classifyMime('text/plain')).toBe('other');
    expect(classifyMime('application/octet-stream')).toBe('other');
    expect(classifyMime('')).toBe('other');
  });
});

describe('resolveLinkTargets', () => {
  function obs(id: string, theme: string): Observation {
    return {
      id,
      profileId: 'p1',
      createdAt: 1,
      updatedAt: 1,
      theme,
      fact: '',
      pattern: '',
      selfRegulation: '',
      status: '',
      source: 'user',
      extraSections: {},
    } as Observation;
  }
  function lv(id: string, parameter: string, reportId: string): LabValue {
    return {
      id,
      profileId: 'p1',
      createdAt: 1,
      updatedAt: 1,
      reportId,
      parameter,
      result: '',
      unit: '',
      referenceRange: '',
      assessment: '',
    } as LabValue;
  }
  function lr(id: string, date: string): LabReport {
    return {
      id,
      profileId: 'p1',
      createdAt: 1,
      updatedAt: 1,
      reportDate: date,
      labName: '',
      orderingDoctor: '',
      summary: '',
      categoryAssessments: {},
    } as LabReport;
  }

  it('resolves observation link to a theme target', () => {
    const doc = makeDoc({ linkedObservationId: 'o1' });
    const targets = resolveLinkTargets(doc, [obs('o1', 'Schulter')], [], []);
    expect(targets).toEqual([{ kind: 'observation', theme: 'Schulter' }]);
  });

  it('returns unknown when the linked observation is missing (lines 69)', () => {
    const doc = makeDoc({ linkedObservationId: 'o-missing' });
    const targets = resolveLinkTargets(doc, [], [], []);
    expect(targets).toEqual([{ kind: 'unknown' }]);
  });

  it('resolves lab-value link to a parameter + date target (lines 73-80)', () => {
    const doc = makeDoc({ linkedLabValueId: 'lv1' });
    const targets = resolveLinkTargets(doc, [], [lv('lv1', 'Hb', 'r1')], [lr('r1', '2026-04-15')]);
    expect(targets).toEqual([{ kind: 'lab-value', parameter: 'Hb', date: '2026-04-15' }]);
  });

  it('falls back to empty date when the lab report is missing (lines 73-80 inner ??)', () => {
    const doc = makeDoc({ linkedLabValueId: 'lv1' });
    const targets = resolveLinkTargets(doc, [], [lv('lv1', 'Hb', 'missing-report')], []);
    expect(targets).toEqual([{ kind: 'lab-value', parameter: 'Hb', date: '' }]);
  });

  it('returns unknown when the linked lab-value is missing (lines 81-82)', () => {
    const doc = makeDoc({ linkedLabValueId: 'lv-missing' });
    const targets = resolveLinkTargets(doc, [], [], []);
    expect(targets).toEqual([{ kind: 'unknown' }]);
  });

  it('handles documents linked to BOTH an observation and a lab-value', () => {
    const doc = makeDoc({ linkedObservationId: 'o1', linkedLabValueId: 'lv1' });
    const targets = resolveLinkTargets(
      doc,
      [obs('o1', 'Blut')],
      [lv('lv1', 'Hb', 'r1')],
      [lr('r1', '2026-04-15')],
    );
    expect(targets).toEqual([
      { kind: 'observation', theme: 'Blut' },
      { kind: 'lab-value', parameter: 'Hb', date: '2026-04-15' },
    ]);
  });
});
