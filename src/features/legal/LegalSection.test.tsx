import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LegalSection } from './LegalSection';

describe('LegalSection', () => {
  it('renders heading + privacy + license links', () => {
    render(
      <MemoryRouter>
        <LegalSection />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Rechtliches' })).toBeInTheDocument();
    const privacyLink = screen.getByTestId('legal-link-privacy');
    expect(privacyLink).toHaveAttribute('href', '/privacy');
    const licenseLink = screen.getByTestId('legal-link-license');
    expect(licenseLink).toHaveAttribute('href', '/license');
  });

  it('renders impressum + datenschutz links (P-16)', () => {
    render(
      <MemoryRouter>
        <LegalSection />
      </MemoryRouter>,
    );
    const impressumLink = screen.getByTestId('legal-link-impressum');
    expect(impressumLink).toHaveAttribute('href', '/impressum');
    const datenschutzLink = screen.getByTestId('legal-link-datenschutz');
    expect(datenschutzLink).toHaveAttribute('href', '/datenschutz');
  });

  it('gives every link a distinct label (BUG-16)', () => {
    render(
      <MemoryRouter>
        <LegalSection />
      </MemoryRouter>,
    );
    const names = screen.getAllByRole('link').map((link) => link.textContent);
    expect(names).toHaveLength(4);
    expect(new Set(names).size).toBe(names.length);
  });

  it('labels the privacy overview and the full policy differently (BUG-16)', () => {
    render(
      <MemoryRouter>
        <LegalSection />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('legal-link-privacy')).toHaveTextContent(
      /^Datenschutz im Überblick$/,
    );
    expect(screen.getByTestId('legal-link-datenschutz')).toHaveTextContent(
      /^Datenschutzerklärung$/,
    );
  });

  it('keeps the global footer label unchanged (BUG-16)', async () => {
    const de = await import('../../locales/de/legal.json');
    expect(de.default.footer['privacy-policy-link']).toBe('Datenschutz');
  });
});
