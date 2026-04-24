import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'fake-indexeddb/auto';
import { lock, unlock } from '../../../crypto';
import { setupCompletedOnboarding } from '../../../db/test-helpers';
import { readMeta } from '../../../db/meta';
import { saveAIConfig, deleteAIConfig } from '../../../db/aiConfig';
import type { ParseResult } from '../parser/types';
import { ImportCleanupScreen, type CleanupSubState } from './ImportCleanupScreen';

const TEST_PASSWORD = 'test-password-12';

async function unlockSession(): Promise<void> {
  const meta = await readMeta();
  await unlock(TEST_PASSWORD, new Uint8Array(meta?.salt ?? new ArrayBuffer(0)));
}

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

function partialResult(observationCount: number): ParseResult {
  const r = emptyResult();
  r.observations = Array.from(
    { length: observationCount },
    () => ({}) as unknown as ParseResult['observations'][number],
  );
  return r;
}

async function configureAI(): Promise<void> {
  await saveAIConfig({
    provider: 'anthropic',
    apiKey: 'sk-ant-test-key-xxxxxxxxx',
    model: 'claude-sonnet-4-6',
  });
}

async function waitForConfigReady(): Promise<void> {
  await new Promise((r) => setTimeout(r, 30));
}

beforeEach(async () => {
  lock();
  await setupCompletedOnboarding(TEST_PASSWORD);
  await unlockSession();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderScreen(
  overrides: Partial<{
    parseResult: ParseResult;
    cleanup: CleanupSubState;
    onRequestCleanup: () => void;
    onProceedWithPartial: () => void;
    onRestart: () => void;
    onNavigateSettings: () => void;
  }> = {},
) {
  const props = {
    parseResult: emptyResult(),
    cleanup: { kind: 'idle' } as CleanupSubState,
    onRequestCleanup: vi.fn(),
    onProceedWithPartial: vi.fn(),
    onRestart: vi.fn(),
    onNavigateSettings: vi.fn(),
    ...overrides,
  };
  render(<ImportCleanupScreen {...props} />);
  return props;
}

describe('ImportCleanupScreen', () => {
  it('shows the "no content extracted" summary for an empty parse result', async () => {
    renderScreen();
    await waitForConfigReady();
    expect(screen.getByText(/keine Inhalte extrahiert/)).toBeInTheDocument();
  });

  it('shows the "few entries recognized" summary with count for a partial parse', async () => {
    renderScreen({ parseResult: partialResult(2) });
    await waitForConfigReady();
    expect(screen.getByText(/Nur wenige Einträge erkannt \(2 insgesamt\)/)).toBeInTheDocument();
  });

  it('offers the cleanup button when AI is configured', async () => {
    await configureAI();
    renderScreen();
    await waitForConfigReady();
    expect(screen.getByTestId('cleanup-request-button')).toBeInTheDocument();
    expect(screen.queryByTestId('cleanup-settings-link')).not.toBeInTheDocument();
  });

  it('shows the settings link when AI is not configured', async () => {
    await deleteAIConfig();
    renderScreen();
    await waitForConfigReady();
    expect(screen.getByTestId('cleanup-settings-link')).toBeInTheDocument();
    expect(screen.queryByTestId('cleanup-request-button')).not.toBeInTheDocument();
  });

  it('clicking KI-Hilfe anfordern calls onRequestCleanup', async () => {
    await configureAI();
    const { onRequestCleanup } = renderScreen();
    await waitForConfigReady();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('cleanup-request-button'));
    expect(onRequestCleanup).toHaveBeenCalledOnce();
  });

  it('disables the cleanup button while loading', async () => {
    await configureAI();
    renderScreen({ cleanup: { kind: 'loading' } });
    await waitForConfigReady();
    expect(screen.getByTestId('cleanup-request-button')).toBeDisabled();
    expect(screen.getByTestId('cleanup-loading')).toHaveTextContent(/KI bereinigt Markdown/);
  });

  it('renders the impossible message when cleanup state is impossible', async () => {
    await configureAI();
    renderScreen({ cleanup: { kind: 'impossible' } });
    await waitForConfigReady();
    expect(screen.getByTestId('cleanup-impossible')).toHaveTextContent(
      /keine verwertbare Struktur/,
    );
  });

  it('renders the raw AI output for parse-failed-after-cleanup', async () => {
    await configureAI();
    renderScreen({
      cleanup: { kind: 'parse-failed-after-cleanup', rawCleaned: 'garbled output' },
    });
    await waitForConfigReady();
    expect(screen.getByTestId('cleanup-raw-output')).toHaveTextContent('garbled output');
  });

  it('renders the auth error message when cleanup state is error/auth', async () => {
    await configureAI();
    renderScreen({ cleanup: { kind: 'error', error: { kind: 'auth' } } });
    await waitForConfigReady();
    expect(screen.getByTestId('cleanup-error')).toHaveTextContent(/API-Schlüssel ungültig/);
  });

  it('hides the proceed-partial button for an empty parse result', async () => {
    renderScreen();
    await waitForConfigReady();
    expect(screen.queryByTestId('cleanup-proceed-partial')).not.toBeInTheDocument();
  });

  it('shows the proceed-partial button for a soft-failure parse', async () => {
    const { onProceedWithPartial } = renderScreen({ parseResult: partialResult(2) });
    await waitForConfigReady();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('cleanup-proceed-partial'));
    expect(onProceedWithPartial).toHaveBeenCalledOnce();
  });
});
