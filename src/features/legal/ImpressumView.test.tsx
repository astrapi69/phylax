import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ImpressumView } from './ImpressumView';

describe('ImpressumView', () => {
  it('renders the heading and intro', () => {
    render(
      <MemoryRouter>
        <ImpressumView />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Impressum' })).toBeInTheDocument();
    expect(screen.getByText(/Digitale-Dienste-Gesetz/)).toBeInTheDocument();
  });

  it('shows a draft notice, since the responsible-party fields are placeholders', () => {
    render(
      <MemoryRouter>
        <ImpressumView />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Entwurf');
  });

  it('renders TODO placeholders for name, address, email and VAT id, no invented data', () => {
    render(
      <MemoryRouter>
        <ImpressumView />
      </MemoryRouter>,
    );
    expect(screen.getByText(/\[TODO: Vollständiger Name eintragen\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[TODO: Ladungsfähige Anschrift eintragen\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[TODO: Kontakt-E-Mail-Adresse eintragen\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[TODO: USt-IdNr\. eintragen/)).toBeInTheDocument();
  });

  it('links onward to the full privacy policy', () => {
    render(
      <MemoryRouter>
        <ImpressumView />
      </MemoryRouter>,
    );
    const link = screen.getByText('Siehe auch die vollständige Datenschutzerklärung.');
    expect(link.closest('a')).toHaveAttribute('href', '/datenschutz');
  });
});
