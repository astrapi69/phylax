import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import i18n from '../../i18n/config';
import { lock, unlock } from '../../crypto';
import { readMeta } from '../../db/meta';
import { setupCompletedOnboarding } from '../../db/test-helpers';
import {
  ProfileRepository,
  DocumentRepository,
  ObservationRepository,
  LabValueRepository,
  LabReportRepository,
} from '../../db/repositories';
import type { Document, Observation, LabValue } from '../../domain';
import { LinkEditor } from './LinkEditor';

const TEST_PASSWORD = 'test-password-12';

async function unlockCurrent(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function seedProfile(): Promise<string> {
  const profile = await new ProfileRepository().create({
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
  return profile.id;
}

async function seedObservation(
  profileId: string,
  theme: string,
  fact: string,
): Promise<Observation> {
  return new ObservationRepository().create({
    profileId,
    theme,
    fact,
    pattern: '',
    selfRegulation: '',
    status: 'stabil',
    source: 'user',
    extraSections: {},
  });
}

async function seedLabValue(
  profileId: string,
  parameter: string,
  result: string,
): Promise<LabValue> {
  const labValueRepo = new LabValueRepository();
  const labReportRepo = new LabReportRepository(labValueRepo);
  const report = await labReportRepo.create({
    profileId,
    reportDate: '2025-01-01',
    categoryAssessments: {},
  });
  return labValueRepo.create({
    profileId,
    reportId: report.id,
    category: 'Blutbild',
    parameter,
    result,
  });
}

async function seedDocument(profileId: string, filename: string): Promise<Document> {
  return new DocumentRepository().create({
    profileId,
    filename,
    mimeType: 'application/pdf',
    sizeBytes: 4,
    content: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer,
  });
}

function renderWithRouter(doc: Document, onChanged: (d: Document) => void) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="*" element={<LinkEditor document={doc} onChanged={onChanged} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockCurrent();
  if (i18n.language !== 'de') {
    void i18n.changeLanguage('de');
  }
});

describe('LinkEditor', () => {
  it('renders "not linked" state with two link-to buttons for an unlinked document', async () => {
    const profileId = await seedProfile();
    const doc = await seedDocument(profileId, 'a.pdf');

    renderWithRouter(doc, vi.fn());

    await waitFor(() =>
      expect(screen.getByTestId('link-status')).toHaveAttribute('data-state', 'none'),
    );
    expect(screen.getByTestId('link-to-observation-btn')).toBeInTheDocument();
    expect(screen.getByTestId('link-to-lab-value-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('unlink-btn')).not.toBeInTheDocument();
  });

  it('clicking "Link to observation" opens an inline picker populated with observations', async () => {
    const profileId = await seedProfile();
    await seedObservation(profileId, 'Blutdruck', 'Messung morgens');
    const doc = await seedDocument(profileId, 'a.pdf');

    renderWithRouter(doc, vi.fn());

    await waitFor(() => expect(screen.getByTestId('link-to-observation-btn')).toBeEnabled());
    await act(async () => {
      fireEvent.click(screen.getByTestId('link-to-observation-btn'));
    });

    const select = screen.getByTestId('link-picker-select') as HTMLSelectElement;
    await waitFor(() => {
      const labels = Array.from(select.options).map((o) => o.textContent ?? '');
      expect(labels.some((l) => l.includes('Blutdruck'))).toBe(true);
    });
  });

  it('save calls linkToObservation and fires onChanged with the updated document', async () => {
    const profileId = await seedProfile();
    const obs = await seedObservation(profileId, 'Blutdruck', 'Messung');
    const doc = await seedDocument(profileId, 'a.pdf');

    const onChanged = vi.fn();
    renderWithRouter(doc, onChanged);

    await waitFor(() => expect(screen.getByTestId('link-to-observation-btn')).toBeEnabled());
    await act(async () => {
      fireEvent.click(screen.getByTestId('link-to-observation-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('link-picker-select')).toBeInTheDocument());

    const select = screen.getByTestId('link-picker-select') as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(select, { target: { value: obs.id } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('link-save-btn'));
    });

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const updated = onChanged.mock.calls[0]?.[0] as Document;
    expect(updated.linkedObservationId).toBe(obs.id);

    // Persisted state reflects the link.
    const readBack = await new DocumentRepository().getById(doc.id);
    expect(readBack?.linkedObservationId).toBe(obs.id);
  });

  it('renders "linked to <name>" for a linked document and unlink calls the repo', async () => {
    const profileId = await seedProfile();
    const obs = await seedObservation(profileId, 'Blutdruck', 'Messung');
    const docRaw = await seedDocument(profileId, 'a.pdf');
    const doc = await new DocumentRepository().linkToObservation(docRaw.id, obs.id);

    const onChanged = vi.fn();
    renderWithRouter(doc, onChanged);

    await waitFor(() =>
      expect(screen.getByTestId('link-status')).toHaveAttribute('data-state', 'linked'),
    );
    expect(screen.getByTestId('link-status-target')).toHaveTextContent(/Blutdruck/);
    expect(screen.getByTestId('link-status-target')).toHaveAttribute('href', '/observations');
    expect(screen.getByTestId('unlink-btn')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('unlink-btn'));
    });

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const updated = onChanged.mock.calls[0]?.[0] as Document;
    expect(updated.linkedObservationId).toBeUndefined();
    expect(updated.linkedLabValueId).toBeUndefined();
  });

  it('renders "missing-entity" warning when the linked observation no longer exists', async () => {
    const profileId = await seedProfile();
    const docRaw = await seedDocument(profileId, 'a.pdf');
    const doc = await new DocumentRepository().linkToObservation(docRaw.id, 'nonexistent-obs-id');

    renderWithRouter(doc, vi.fn());

    await waitFor(() =>
      expect(screen.getByTestId('link-status')).toHaveAttribute('data-state', 'unresolved'),
    );
    expect(screen.getByTestId('unlink-btn')).toBeInTheDocument();
  });

  it('linking to a lab value populates the picker + persists the link', async () => {
    const profileId = await seedProfile();
    const lv = await seedLabValue(profileId, 'Kreatinin', '1.0');
    const doc = await seedDocument(profileId, 'a.pdf');

    const onChanged = vi.fn();
    renderWithRouter(doc, onChanged);

    await waitFor(() => expect(screen.getByTestId('link-to-lab-value-btn')).toBeEnabled());
    await act(async () => {
      fireEvent.click(screen.getByTestId('link-to-lab-value-btn'));
    });
    await waitFor(() => expect(screen.getByTestId('link-picker-select')).toBeInTheDocument());

    const select = screen.getByTestId('link-picker-select') as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(select, { target: { value: lv.id } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('link-save-btn'));
    });

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const updated = onChanged.mock.calls[0]?.[0] as Document;
    expect(updated.linkedLabValueId).toBe(lv.id);
    expect(updated.linkedObservationId).toBeUndefined();
  });
});
