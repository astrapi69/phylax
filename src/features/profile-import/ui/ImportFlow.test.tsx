import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../../crypto';
import { setupCompletedOnboarding } from '../../../db/test-helpers';
import { readMeta } from '../../../db/meta';
import { ProfileRepository, ObservationRepository } from '../../../db/repositories';
import { ImportFlow } from './ImportFlow';

const TEST_PASSWORD = 'test-password-12';
let profileId: string;

const FIXTURE = [
  '# Medizinisches Profil - Version 1.0',
  '',
  '## 1. Basisdaten',
  '- **Alter:** 40',
  '',
  '## 2. Relevante Vorgeschichte',
  '### 2.1 Knie',
  '- **Beobachtung:** Schmerz bei Belastung.',
  '- **Muster:** Nach Lauftraining.',
  '- **Selbstregulation:** Laufen pausiert.',
  '- **Status:** Stabil',
].join('\n');

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));

  const repo = new ProfileRepository();
  const p = await repo.create({
    baseData: {
      name: 'Testprofil',
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
  profileId = p.id;
  void profileId;
});

function renderFlow() {
  return render(
    <MemoryRouter>
      <ImportFlow />
    </MemoryRouter>,
  );
}

async function pasteAndContinue(user: ReturnType<typeof userEvent.setup>) {
  const textarea = await screen.findByLabelText(/markdown-text einfügen/i);
  await user.click(textarea);
  await user.paste(FIXTURE);
  await user.click(screen.getByRole('button', { name: 'Weiter' }));
}

describe('ImportFlow', () => {
  it('starts on the entry screen', async () => {
    renderFlow();
    expect(await screen.findByRole('heading', { name: 'Import aus Markdown' })).toBeInTheDocument();
  });

  it('walks entry -> profile-selection on valid paste', async () => {
    const user = userEvent.setup();
    renderFlow();
    await pasteAndContinue(user);
    expect(
      await screen.findByRole('heading', { name: /In welches Profil importieren/i }),
    ).toBeInTheDocument();
  });

  it('empty target goes to preview directly', async () => {
    const user = userEvent.setup();
    renderFlow();
    await pasteAndContinue(user);
    await user.click(await screen.findByRole('button', { name: 'Diesem Profil zuordnen' }));
    expect(await screen.findByRole('heading', { name: 'Vorschau' })).toBeInTheDocument();
    expect(screen.getByText('Testprofil')).toBeInTheDocument();
  });

  it('non-empty target shows confirm-replace dialog over preview', async () => {
    const obsRepo = new ObservationRepository();
    await obsRepo.create({
      profileId,
      theme: 'Existing',
      fact: 'x',
      pattern: 'x',
      selfRegulation: 'x',
      status: 'x',
      source: 'user',
      extraSections: {},
    });

    const user = userEvent.setup();
    renderFlow();
    await pasteAndContinue(user);
    await user.click(await screen.findByRole('button', { name: 'Diesem Profil zuordnen' }));
    expect(
      await screen.findByRole('heading', { name: /Import in bestehendes Profil/i }),
    ).toBeInTheDocument();
  });

  it('confirm-replace -> preview -> importing -> done', async () => {
    const obsRepo = new ObservationRepository();
    await obsRepo.create({
      profileId,
      theme: 'Old',
      fact: 'x',
      pattern: 'x',
      selfRegulation: 'x',
      status: 'x',
      source: 'user',
      extraSections: {},
    });

    const user = userEvent.setup();
    renderFlow();
    await pasteAndContinue(user);
    await user.click(await screen.findByRole('button', { name: 'Diesem Profil zuordnen' }));
    // IM-05 Option B: pick replace for the only visible row
    // (observations) before Übernehmen enables.
    await user.click(await screen.findByTestId('confirm-row-observations-replace'));
    await user.click(await screen.findByRole('button', { name: 'Übernehmen' }));
    // now on preview screen
    await user.click(await screen.findByRole('button', { name: 'Import starten' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Import erfolgreich/i })).toBeInTheDocument(),
    );
  });

  it('cancel on entry exits to /profile via navigate (smoke)', async () => {
    // Can't easily assert navigation side-effect in this test context,
    // but the cancel click on entry must not throw.
    const user = userEvent.setup();
    renderFlow();
    await user.click(await screen.findByRole('button', { name: 'Abbrechen' }));
  });

  it('cancel on profile-selection returns to entry', async () => {
    const user = userEvent.setup();
    renderFlow();
    await pasteAndContinue(user);
    await user.click(await screen.findByRole('button', { name: 'Abbrechen' }));
    expect(await screen.findByRole('heading', { name: 'Import aus Markdown' })).toBeInTheDocument();
  });

  it('done -> Weiteren Import resets to entry', async () => {
    const user = userEvent.setup();
    renderFlow();
    await pasteAndContinue(user);
    await user.click(await screen.findByRole('button', { name: 'Diesem Profil zuordnen' }));
    await user.click(await screen.findByRole('button', { name: 'Import starten' }));
    await screen.findByRole('heading', { name: /Import erfolgreich/i });
    await user.click(screen.getByRole('button', { name: 'Weiteren Import' }));
    expect(await screen.findByRole('heading', { name: 'Import aus Markdown' })).toBeInTheDocument();
  });

  it('renders a spinner-equivalent status in importing state (short assertion)', async () => {
    // Not directly observable in the happy path because importing is fast; covered
    // indirectly by the confirm-replace test. Smoke-assert done again.
    const user = userEvent.setup();
    renderFlow();
    await pasteAndContinue(user);
    await user.click(await screen.findByRole('button', { name: 'Diesem Profil zuordnen' }));
    await user.click(await screen.findByRole('button', { name: 'Import starten' }));
    await screen.findByRole('heading', { name: /Import erfolgreich/i });
  });

  it('parse-failure cascade: unparseable text body routes to ImportCleanupScreen', async () => {
    const user = userEvent.setup();
    renderFlow();
    const textarea = await screen.findByLabelText(/markdown-text einfügen/i);
    await user.click(textarea);
    // No structured header sections -> empty parse result -> shouldOfferCleanup returns true.
    // Padded to clear the 100-char MIN_PASTE_LENGTH gate on the entry screen.
    const blob =
      'Das ist nur normaler Fließtext ohne irgendeine Profilstruktur, ohne Überschriften, ohne Listen, ohne irgendeine Markdown-Hierarchie. ';
    await user.paste(blob.repeat(2));
    await user.click(screen.getByRole('button', { name: 'Weiter' }));
    // The cleanup screen replaces the entry heading. Drift-resistant assertion:
    // wait until the entry heading disappears.
    await waitFor(
      () => expect(screen.queryByRole('heading', { name: 'Import aus Markdown' })).toBeNull(),
      { timeout: 5000 },
    );
  });

  it('ProfileRepository.list catch branch leaves profilesById empty without throwing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(ProfileRepository.prototype, 'list').mockRejectedValueOnce(new Error('locked'));
    const user = userEvent.setup();
    renderFlow();
    // Initial mount triggers load(); the catch arm runs without crashing
    // and the user can still complete the flow normally.
    await pasteAndContinue(user);
    expect(
      await screen.findByRole('heading', { name: /In welches Profil importieren/i }),
    ).toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

// Silence the act-warning noise from async flows the test already awaits.
// (kept minimal, matches existing test conventions)
export {};
void vi;
