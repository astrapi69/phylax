import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import i18n from '../../i18n/config';
import { PrivacyView } from './PrivacyView';

function renderInRouter() {
  return render(
    <MemoryRouter initialEntries={['/privacy']}>
      <Routes>
        <Route path="/privacy" element={<PrivacyView />} />
        <Route path="/welcome" element={<div data-testid="destination-welcome" />} />
        <Route path="/setup" element={<div data-testid="destination-setup" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PrivacyView', () => {
  beforeEach(() => {
    if (i18n.language !== 'de') {
      void i18n.changeLanguage('de');
    }
  });

  afterAll(() => {
    // Reset language after EN sampling test at the end of the suite.
    void i18n.changeLanguage('de');
  });

  it('renders the headline', () => {
    renderInRouter();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Du hältst den einzigen Schlüssel.' }),
    ).toBeInTheDocument();
  });

  it('renders all three section titles and bodies', () => {
    renderInRouter();
    expect(screen.getByRole('heading', { level: 2, name: 'Was Phylax tut' })).toBeInTheDocument();
    expect(screen.getByText(/Speichert deine Einträge verschlüsselt/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Was Phylax nicht tut' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Keine Server-Kommunikation/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Was das für dich bedeutet' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Wenn du dein Passwort verlierst/)).toBeInTheDocument();
  });

  it('primary CTA click navigates to /setup', async () => {
    const user = userEvent.setup();
    renderInRouter();
    await user.click(screen.getByRole('button', { name: 'Verstanden, weiter' }));
    expect(screen.getByTestId('destination-setup')).toBeInTheDocument();
  });

  it('back CTA click navigates to /welcome', async () => {
    const user = userEvent.setup();
    renderInRouter();
    await user.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(screen.getByTestId('destination-welcome')).toBeInTheDocument();
  });

  it('has correct heading hierarchy (1 h1 + 3 h2)', () => {
    renderInRouter();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
  });

  it('gives the h1 a programmatic focus target (tabIndex=-1)', () => {
    renderInRouter();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveAttribute('tabindex', '-1');
  });

  it('renders English translations when i18n language is en', async () => {
    await i18n.changeLanguage('en');
    renderInRouter();
    expect(
      screen.getByRole('heading', { level: 1, name: 'You hold the only key.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'What Phylax does' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Got it, continue' })).toBeInTheDocument();
  });
});
