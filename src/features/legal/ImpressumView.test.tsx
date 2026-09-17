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

  it('renders the responsible party name, address and email, no placeholders', () => {
    render(
      <MemoryRouter>
        <ImpressumView />
      </MemoryRouter>,
    );
    const address = screen.getByTestId('impressum-address');
    expect(address).toHaveTextContent('Asterios Raptis');
    expect(address).toHaveTextContent('Seestraße 68');
    expect(address).toHaveTextContent('71638 Ludwigsburg');
    expect(screen.queryByText(/\[TODO/)).not.toBeInTheDocument();
    const emailLink = screen.getByRole('link', { name: 'asterios.raptis@web.de' });
    expect(emailLink).toHaveAttribute('href', 'mailto:asterios.raptis@web.de');
  });

  it('has no VAT id section, since none applies', () => {
    render(
      <MemoryRouter>
        <ImpressumView />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/USt-IdNr/)).not.toBeInTheDocument();
  });

  it('covers liability for content, liability for links, copyright and dispute resolution', () => {
    render(
      <MemoryRouter>
        <ImpressumView />
      </MemoryRouter>,
    );
    expect(screen.getByText('Haftung für Inhalte')).toBeInTheDocument();
    expect(screen.getByText('Haftung für Links')).toBeInTheDocument();
    expect(screen.getByText('Urheberrecht')).toBeInTheDocument();
    expect(screen.getByText('Verbraucherstreitbeilegung')).toBeInTheDocument();
  });

  it('links onward to the full privacy policy', () => {
    render(
      <MemoryRouter>
        <ImpressumView />
      </MemoryRouter>,
    );
    const link = screen.getByText('Siehe auch die Datenschutzerklärung.');
    expect(link.closest('a')).toHaveAttribute('href', '/datenschutz');
  });
});
