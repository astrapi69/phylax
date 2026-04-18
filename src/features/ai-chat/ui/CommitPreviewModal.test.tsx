import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../../crypto';
import { setupCompletedOnboarding } from '../../../db/test-helpers';
import { readMeta } from '../../../db/meta';
import { ProfileRepository, ObservationRepository } from '../../../db/repositories';
import type { Profile } from '../../../domain';
import { CommitPreviewModal } from './CommitPreviewModal';
import { detectProfileFragment, type DetectedFragment } from '../detection';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

async function seedProfile(): Promise<Profile> {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
  const repo = new ProfileRepository();
  return repo.create({
    baseData: {
      name: 'Max',
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
}

function requireFragment(raw: string): DetectedFragment {
  const f = detectProfileFragment(raw);
  if (!f) throw new Error('expected a detected fragment');
  return f;
}

beforeEach(async () => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const NEW_OBS_FRAGMENT = requireFragment(
  `### Knie rechts
- **Status:** Akut
- **Beobachtung:** Schmerzen nach dem Lauftraining
- **Muster:** Belastungsabhaengig
- **Selbstregulation:** Pause, Waerme`,
);

const MIXED_FRAGMENT = requireFragment(`### Linke Schulter
- **Status:** Stabil
- **Beobachtung:** Deutlich weniger Druckschmerz
- **Muster:** SCM-Kompensation
- **Selbstregulation:** SCM-Routine + Mobility

### Knie rechts
- **Status:** Akut
- **Beobachtung:** Schmerzen nach dem Lauftraining

## Supplemente

| Kategorie | Praeparat |
| --- | --- |
| taeglich | Magnesium 400 |

## Offene Punkte

### Beim naechsten Arztbesuch
- MRT Knie rechts besprechen
- TSH-Wert nachmessen`);

describe('CommitPreviewModal (diff view)', () => {
  it('renders a loading state while profile data is fetched', async () => {
    await seedProfile();
    render(<CommitPreviewModal fragment={NEW_OBS_FRAGMENT} onClose={vi.fn()} />);
    expect(screen.getByTestId('commit-preview-loading')).toBeInTheDocument();
    // Wait for the async load to settle before unmounting so React doesn't
    // warn about a state update on an unmounted component.
    await waitFor(() =>
      expect(screen.queryByTestId('commit-preview-loading')).not.toBeInTheDocument(),
    );
  });

  it('renders an error when the key store is locked', async () => {
    await seedProfile();
    lock();
    render(<CommitPreviewModal fragment={NEW_OBS_FRAGMENT} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('commit-preview-error')).toHaveTextContent(/gesperrt/),
    );
  });

  it('renders a [neu] badge for an entirely new observation', async () => {
    await seedProfile();
    render(<CommitPreviewModal fragment={NEW_OBS_FRAGMENT} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('commit-preview-observations')).toBeInTheDocument(),
    );

    const row = screen.getByTestId('observation-new');
    expect(row).toHaveTextContent(/neu/i);
    expect(row).toHaveTextContent('Knie rechts');
    expect(row).toHaveTextContent('Akut');
  });

  it('renders an [aktualisiert] badge for a changed observation and shows old -> new for changed fields', async () => {
    const profile = await seedProfile();
    const obsRepo = new ObservationRepository();
    await obsRepo.create({
      profileId: profile.id,
      theme: 'Linke Schulter',
      status: 'Chronisch',
      fact: 'Druckschmerz',
      pattern: 'SCM-Kompensation',
      selfRegulation: 'SCM-Routine + Mobility',
      source: 'user',
      extraSections: {},
    });

    render(<CommitPreviewModal fragment={MIXED_FRAGMENT} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('observation-changed')).toBeInTheDocument());

    const changedRow = screen.getByTestId('observation-changed');
    expect(changedRow).toHaveTextContent(/aktualisiert/i);
    expect(changedRow).toHaveTextContent('Linke Schulter');
    // Changed field (Status) shows old and new values
    expect(changedRow).toHaveTextContent('Chronisch');
    expect(changedRow).toHaveTextContent('Stabil');
  });

  it('hides "(unveraendert)" lines by default and reveals them when the toggle is on', async () => {
    const profile = await seedProfile();
    await new ObservationRepository().create({
      profileId: profile.id,
      theme: 'Linke Schulter',
      status: 'Chronisch',
      fact: 'Druckschmerz',
      pattern: 'SCM-Kompensation',
      selfRegulation: 'SCM-Routine + Mobility',
      source: 'user',
      extraSections: {},
    });

    const user = userEvent.setup();
    render(<CommitPreviewModal fragment={MIXED_FRAGMENT} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('observation-changed')).toBeInTheDocument());

    const changedRow = screen.getByTestId('observation-changed');
    // Default: unchanged fields hidden (no "(unveraendert)" visible)
    expect(changedRow).not.toHaveTextContent(/unveraendert/);

    await user.click(screen.getByTestId('commit-preview-unchanged-toggle'));

    // Toggle on: unchanged fields appear
    expect(screen.getByTestId('observation-changed')).toHaveTextContent(/unveraendert/i);
  });

  it('auto-populates the version description from the diff, and the user can edit it', async () => {
    await seedProfile();
    const user = userEvent.setup();
    render(<CommitPreviewModal fragment={NEW_OBS_FRAGMENT} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByTestId('commit-preview-version')).toBeInTheDocument());
    const input = screen.getByLabelText('Beschreibung der Aenderung') as HTMLInputElement;
    expect(input.value).toContain('KI-Update');
    expect(input.value).toContain('Knie rechts neu');

    await user.clear(input);
    await user.type(input, 'Meine Beschreibung');
    expect(input).toHaveValue('Meine Beschreibung');
  });

  it('shows the "Keine Aenderungen" banner when the diff is empty', async () => {
    const profile = await seedProfile();
    // Seed an observation identical to what the fragment carries, so the
    // diff comes out all-unchanged.
    await new ObservationRepository().create({
      profileId: profile.id,
      theme: 'Knie rechts',
      status: 'Akut',
      fact: 'Schmerzen nach dem Lauftraining',
      pattern: 'Belastungsabhaengig',
      selfRegulation: 'Pause, Waerme',
      source: 'user',
      extraSections: {},
    });

    render(<CommitPreviewModal fragment={NEW_OBS_FRAGMENT} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('commit-preview-empty')).toBeInTheDocument());
    expect(screen.getByTestId('commit-preview-empty')).toHaveTextContent(/Keine Aenderungen/i);
  });

  it('renders the parser / diff warnings block when multi-match observations are found', async () => {
    const profile = await seedProfile();
    const repo = new ObservationRepository();
    await repo.create({
      profileId: profile.id,
      theme: 'Linke Schulter',
      status: 'Alt-A',
      fact: '',
      pattern: '',
      selfRegulation: '',
      source: 'user',
      extraSections: {},
    });
    await repo.create({
      profileId: profile.id,
      theme: 'Linke Schulter',
      status: 'Alt-B',
      fact: '',
      pattern: '',
      selfRegulation: '',
      source: 'user',
      extraSections: {},
    });

    render(<CommitPreviewModal fragment={MIXED_FRAGMENT} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('commit-preview-warnings')).toBeInTheDocument());
    expect(screen.getByTestId('commit-preview-warnings')).toHaveTextContent(
      /Mehrere Beobachtungen mit Thema "Linke Schulter"/,
    );
  });

  it('renders [neu] supplement and open-points blocks for the mixed fragment', async () => {
    await seedProfile();
    render(<CommitPreviewModal fragment={MIXED_FRAGMENT} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('commit-preview-supplements')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('supplement-new')).toHaveTextContent('Magnesium 400');
    expect(screen.getByTestId('commit-preview-open-points')).toHaveTextContent(
      'MRT Knie rechts besprechen',
    );
  });

  it('Uebernehmen button stays disabled with the AI-08b tooltip', async () => {
    await seedProfile();
    render(<CommitPreviewModal fragment={NEW_OBS_FRAGMENT} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('commit-preview-version')).toBeInTheDocument());

    const btn = screen.getByRole('button', { name: 'Uebernehmen' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).toHaveAttribute('title', expect.stringMatching(/AI-08b/));
  });

  it('"Schliessen" button calls onClose', async () => {
    await seedProfile();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CommitPreviewModal fragment={NEW_OBS_FRAGMENT} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Schliessen' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('exposes a dialog role with aria-modal and focuses "Schliessen" on mount', async () => {
    await seedProfile();
    render(<CommitPreviewModal fragment={NEW_OBS_FRAGMENT} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('commit-preview-version')).toBeInTheDocument());

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'commit-preview-title');
    expect(screen.getByRole('button', { name: 'Schliessen' })).toHaveFocus();
  });
});
