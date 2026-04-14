import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultScreen } from './ResultScreen';
import { EMPTY_COUNTS } from '../import';

const SUCCESS_RESULT = {
  targetProfileId: 'p1',
  replaced: false,
  created: { ...EMPTY_COUNTS, observations: 18, labReports: 1, labValues: 26, supplements: 9 },
};

describe('ResultScreen', () => {
  it('renders success variant with counts and target name', () => {
    render(
      <ResultScreen
        outcome={{
          kind: 'success',
          importResult: SUCCESS_RESULT,
          targetProfileName: 'Mein Profil',
        }}
        onNavigateHome={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: /Import erfolgreich/i })).toBeInTheDocument();
    expect(screen.getByText(/In "Mein Profil" importiert:/)).toBeInTheDocument();
    expect(screen.getByText(/18 Beobachtungen/)).toBeInTheDocument();
  });

  it('success "Zur Übersicht" calls onNavigateHome', async () => {
    const user = userEvent.setup();
    const onNavigateHome = vi.fn();
    render(
      <ResultScreen
        outcome={{ kind: 'success', importResult: SUCCESS_RESULT, targetProfileName: 'X' }}
        onNavigateHome={onNavigateHome}
        onRestart={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Zur Übersicht' }));
    expect(onNavigateHome).toHaveBeenCalledOnce();
  });

  it('success "Weiteren Import" calls onRestart', async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();
    render(
      <ResultScreen
        outcome={{ kind: 'success', importResult: SUCCESS_RESULT, targetProfileName: 'X' }}
        onNavigateHome={vi.fn()}
        onRestart={onRestart}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Weiteren Import' }));
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('renders failure variant with message', () => {
    render(
      <ResultScreen
        outcome={{ kind: 'failure', message: 'Testfehler' }}
        onNavigateHome={vi.fn()}
        onRestart={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: /Import fehlgeschlagen/i })).toBeInTheDocument();
    expect(screen.getByText('Testfehler')).toBeInTheDocument();
    expect(screen.getByText(/nicht geändert/i)).toBeInTheDocument();
  });

  it('failure "Erneut versuchen" calls onRestart', async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();
    render(
      <ResultScreen
        outcome={{ kind: 'failure', message: 'Fehler' }}
        onNavigateHome={vi.fn()}
        onRestart={onRestart}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onRestart).toHaveBeenCalledOnce();
  });
});
