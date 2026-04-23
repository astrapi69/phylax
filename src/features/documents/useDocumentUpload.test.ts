import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { renderHook, act, waitFor } from '@testing-library/react';
import { lock } from '../../crypto';
import { setupCompletedOnboarding, resetDatabase } from '../../db/test-helpers';
import {
  ProfileRepository,
  DocumentRepository,
  DOCUMENT_SIZE_LIMIT_BYTES,
} from '../../db/repositories';
import { useDocumentUpload } from './useDocumentUpload';

const TEST_PASSWORD = 'test-password-12';

function makeFile(parts: BlobPart[], filename: string, type: string): File {
  return new File(parts, filename, { type });
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const { readMeta } = await import('../../db/meta');
  const { unlock } = await import('../../crypto');
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

  await new ProfileRepository().create({
    baseData: {
      weightHistory: [],
      knownDiagnoses: [],
      currentMedications: [],
      relevantLimitations: [],
      profileType: 'self',
    },
    warningSigns: [],
    externalReferences: [],
    version: '1.0',
  });
});

describe('useDocumentUpload', () => {
  it('starts in idle status', () => {
    const { result } = renderHook(() => useDocumentUpload());
    expect(result.current.status.kind).toBe('idle');
  });

  it('rejects an unsupported MIME type before any IO', async () => {
    const { result } = renderHook(() => useDocumentUpload());
    const file = makeFile([new Uint8Array([0])], 'a.txt', 'text/plain');

    await act(async () => {
      await result.current.upload(file);
    });

    expect(result.current.status.kind).toBe('error');
    if (result.current.status.kind === 'error') {
      expect(result.current.status.error.kind).toBe('unsupported-type');
    }

    // Nothing persisted.
    const repo = new DocumentRepository();
    const all = await repo.listAll();
    expect(all).toHaveLength(0);
  });

  it('rejects a file larger than DOCUMENT_SIZE_LIMIT_BYTES with structured error', async () => {
    const { result } = renderHook(() => useDocumentUpload());
    const oversized = new Uint8Array(DOCUMENT_SIZE_LIMIT_BYTES + 1);
    const file = makeFile([oversized], 'big.pdf', 'application/pdf');

    await act(async () => {
      await result.current.upload(file);
    });

    expect(result.current.status.kind).toBe('error');
    if (
      result.current.status.kind === 'error' &&
      result.current.status.error.kind === 'file-too-large'
    ) {
      expect(result.current.status.error.actualBytes).toBe(DOCUMENT_SIZE_LIMIT_BYTES + 1);
      expect(result.current.status.error.limitBytes).toBe(DOCUMENT_SIZE_LIMIT_BYTES);
    } else {
      throw new Error('expected file-too-large error');
    }
  });

  it('uploads an accepted file and reports success with the new Document', async () => {
    const { result } = renderHook(() => useDocumentUpload());
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // %PDF-1.7
    const file = makeFile([bytes], 'doc.pdf', 'application/pdf');

    await act(async () => {
      await result.current.upload(file);
    });

    await waitFor(() => expect(result.current.status.kind).toBe('success'));
    if (result.current.status.kind === 'success') {
      expect(result.current.status.document.filename).toBe('doc.pdf');
      expect(result.current.status.document.mimeType).toBe('application/pdf');
      expect(result.current.status.document.sizeBytes).toBe(8);
    }

    // Round-trip via repo to confirm persistence + content fidelity.
    if (result.current.status.kind !== 'success') throw new Error('unreachable');
    const repo = new DocumentRepository();
    const content = await repo.getContent(result.current.status.document.id);
    if (!content) throw new Error('expected persisted content');
    expect(new Uint8Array(content)).toEqual(bytes);
  });

  it('reset returns the hook to idle from any terminal state', async () => {
    const { result } = renderHook(() => useDocumentUpload());
    const file = makeFile([new Uint8Array([0])], 'a.txt', 'text/plain');

    await act(async () => {
      await result.current.upload(file);
    });
    expect(result.current.status.kind).toBe('error');

    act(() => result.current.reset());
    expect(result.current.status.kind).toBe('idle');
  });

  it('emits no-profile error when no profile exists', async () => {
    // Wipe profiles between beforeEach setup and this test.
    await resetDatabase();
    // Re-unlock against a fresh meta (resetDatabase rebuilt the DB);
    // setupCompletedOnboarding restores meta but we already used the
    // current-profile path so re-derive a fresh keystore-locked state.
    const { unlock } = await import('../../crypto');
    await setupCompletedOnboarding(TEST_PASSWORD);
    const { readMeta } = await import('../../db/meta');
    const meta = await readMeta();
    await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
    // No profile created this round.

    const { result } = renderHook(() => useDocumentUpload());
    const file = makeFile([new Uint8Array([0x89, 0x50])], 'a.png', 'image/png');

    await act(async () => {
      await result.current.upload(file);
    });

    expect(result.current.status.kind).toBe('error');
    if (result.current.status.kind === 'error') {
      expect(result.current.status.error.kind).toBe('no-profile');
    }
  });
});
