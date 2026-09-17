import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DatenschutzView } from './DatenschutzView';

describe('DatenschutzView', () => {
  it('renders the heading and intro', () => {
    render(
      <MemoryRouter>
        <DatenschutzView />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' }),
    ).toBeInTheDocument();
  });

  it('renders the controller name, address and email, no placeholders', () => {
    render(
      <MemoryRouter>
        <DatenschutzView />
      </MemoryRouter>,
    );
    const address = screen.getByTestId('datenschutz-address');
    expect(address).toHaveTextContent('Asterios Raptis');
    expect(address).toHaveTextContent('Seestraße 68');
    expect(screen.queryByText(/\[TODO/)).not.toBeInTheDocument();
    const emailLink = screen.getByRole('link', { name: 'asterios.raptis@web.de' });
    expect(emailLink).toHaveAttribute('href', 'mailto:asterios.raptis@web.de');
  });

  it('covers hosting, local storage, API key, update checks, AI chat, file import and no-tracking sections', () => {
    render(
      <MemoryRouter>
        <DatenschutzView />
      </MemoryRouter>,
    );
    expect(screen.getByText('Hosting bei GitHub Pages')).toBeInTheDocument();
    expect(screen.getByText('Speicherung im Browser')).toBeInTheDocument();
    expect(screen.getByText('KI-API-Schlüssel')).toBeInTheDocument();
    expect(screen.getByText('Update-Prüfung')).toBeInTheDocument();
    expect(screen.getByText('Optionaler KI-Chat')).toBeInTheDocument();
    expect(screen.getByText('Import von Dateien')).toBeInTheDocument();
    expect(screen.getByText('Externe Links')).toBeInTheDocument();
    expect(screen.getByText('Keine Cookies, kein Tracking, keine Analytics')).toBeInTheDocument();
  });

  it('states the AI API key is encrypted, not stored in plaintext', () => {
    render(
      <MemoryRouter>
        <DatenschutzView />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Anders als reiner Klartext/)).toBeInTheDocument();
  });

  it('links to the GitHub Privacy Statement from the hosting section', () => {
    render(
      <MemoryRouter>
        <DatenschutzView />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'GitHub Privacy Statement' });
    expect(link).toHaveAttribute(
      'href',
      'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement',
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('links to each supported AI provider privacy policy', () => {
    render(
      <MemoryRouter>
        <DatenschutzView />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Anthropic (Claude)' })).toHaveAttribute(
      'href',
      'https://privacy.claude.com/',
    );
    expect(screen.getByRole('link', { name: 'OpenAI (GPT)' })).toHaveAttribute(
      'href',
      'https://openai.com/policies/privacy-policy',
    );
    expect(screen.getByRole('link', { name: 'Google (Gemini)' })).toHaveAttribute(
      'href',
      'https://policies.google.com/privacy',
    );
    expect(screen.getByRole('link', { name: 'Mistral' })).toHaveAttribute(
      'href',
      'https://mistral.ai/terms/#privacy-policy',
    );
  });

  it('names all six DSGVO rights plus the complaint right', () => {
    render(
      <MemoryRouter>
        <DatenschutzView />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Auskunft, Berichtigung, Löschung/)).toBeInTheDocument();
    expect(screen.getByText(/Datenschutzaufsichtsbehörde beschweren/)).toBeInTheDocument();
  });

  it('links back to the Impressum', () => {
    render(
      <MemoryRouter>
        <DatenschutzView />
      </MemoryRouter>,
    );
    const link = screen.getByText('Siehe auch das Impressum.');
    expect(link.closest('a')).toHaveAttribute('href', '/impressum');
  });
});
