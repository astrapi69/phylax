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

  it('shows a draft notice, since the text is pending legal review', () => {
    render(
      <MemoryRouter>
        <DatenschutzView />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Entwurf');
  });

  it('renders TODO placeholders for the controller, no invented data', () => {
    render(
      <MemoryRouter>
        <DatenschutzView />
      </MemoryRouter>,
    );
    expect(screen.getByText(/\[TODO: Vollständiger Name eintragen\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[TODO: Ladungsfähige Anschrift eintragen\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[TODO: Kontakt-E-Mail-Adresse eintragen\]/)).toBeInTheDocument();
  });

  it('covers hosting, local storage, encryption, AI chat and no-tracking sections', () => {
    render(
      <MemoryRouter>
        <DatenschutzView />
      </MemoryRouter>,
    );
    expect(screen.getByText('Hosting über GitHub Pages')).toBeInTheDocument();
    expect(screen.getByText('Lokale Speicherung auf dem Endgerät')).toBeInTheDocument();
    expect(screen.getByText('Verschlüsselung')).toBeInTheDocument();
    expect(screen.getByText('Optionaler KI-Chat')).toBeInTheDocument();
    expect(screen.getByText('Keine Cookies, kein Tracking, keine Analytics')).toBeInTheDocument();
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

  it('lists the three data subject rights as a factual enumeration', () => {
    render(
      <MemoryRouter>
        <DatenschutzView />
      </MemoryRouter>,
    );
    expect(screen.getByText('Auskunft über die verarbeiteten Daten')).toBeInTheDocument();
    expect(screen.getByText('Löschung der verarbeiteten Daten')).toBeInTheDocument();
    expect(screen.getByText('Widerspruch gegen die Verarbeitung')).toBeInTheDocument();
  });
});
