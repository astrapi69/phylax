import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import i18n from '../../i18n/config';
import { WelcomeView } from './WelcomeView';

function renderInRouter() {
  return render(
    <MemoryRouter initialEntries={['/welcome']}>
      <Routes>
        <Route path="/welcome" element={<WelcomeView />} />
        <Route path="/privacy" element={<div data-testid="destination-privacy" />} />
        <Route path="/backup/import/select" element={<div data-testid="destination-import" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('WelcomeView', () => {
  beforeEach(() => {
    // Reset to DE for each test; final EN-sampling test re-enters EN.
    if (i18n.language !== 'de') {
      void i18n.changeLanguage('de');
    }
  });

  it('renders the Phylax heading', () => {
    renderInRouter();
    expect(screen.getByRole('heading', { level: 1, name: 'Phylax' })).toBeInTheDocument();
  });

  it('renders the tagline', () => {
    renderInRouter();
    expect(
      screen.getByText('Deine Gesundheitsdaten. Lokal. Verschlüsselt. Deins.'),
    ).toBeInTheDocument();
  });

  it('renders all three trust signals with titles and bodies', () => {
    renderInRouter();
    expect(screen.getByRole('heading', { level: 2, name: 'Lokal' })).toBeInTheDocument();
    expect(screen.getByText('Alle Daten bleiben auf diesem Gerät.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Verschlüsselt' })).toBeInTheDocument();
    expect(screen.getByText('AES-256 mit deinem Passwort.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Offen' })).toBeInTheDocument();
    expect(screen.getByText('Kein Konto, kein Server, kein Tracking.')).toBeInTheDocument();
  });

  it('primary CTA click navigates to /privacy', async () => {
    const user = userEvent.setup();
    renderInRouter();
    await user.click(screen.getByRole('button', { name: 'Einrichten starten' }));
    expect(screen.getByTestId('destination-privacy')).toBeInTheDocument();
  });

  it('import link click navigates to /backup/import/select', async () => {
    const user = userEvent.setup();
    renderInRouter();
    await user.click(screen.getByRole('link', { name: 'Ich habe bereits ein Backup' }));
    expect(screen.getByTestId('destination-import')).toBeInTheDocument();
  });

  it('has correct heading hierarchy (1 h1 + 3 h2)', () => {
    renderInRouter();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
  });

  it('gives the h1 a programmatic focus target (tabIndex=-1)', () => {
    renderInRouter();
    const h1 = screen.getByRole('heading', { level: 1, name: 'Phylax' });
    expect(h1).toHaveAttribute('tabindex', '-1');
  });
});
