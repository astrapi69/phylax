import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ObservationCard } from './ObservationCard';
import { makeObservation } from './test-helpers';

describe('ObservationCard', () => {
  it('renders status and an excerpt of the fact in the summary', () => {
    render(
      <ObservationCard
        observation={makeObservation({
          status: 'Chronisch-rezidivierend',
          fact: 'Schulterschmerz links bei Ueberkopfbewegung.',
        })}
      />,
    );
    expect(screen.getByText('Chronisch-rezidivierend')).toBeInTheDocument();
    expect(
      screen.getAllByText('Schulterschmerz links bei Ueberkopfbewegung.').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('is collapsed by default and opens with defaultOpen', () => {
    const { container, rerender } = render(<ObservationCard observation={makeObservation()} />);
    const details = container.querySelector('details');
    expect(details?.open).toBe(false);

    rerender(<ObservationCard observation={makeObservation()} defaultOpen />);
    expect(container.querySelector('details')?.open).toBe(true);
  });

  it('renders fact, pattern and selfRegulation fields when expanded', () => {
    render(
      <ObservationCard
        observation={makeObservation({
          fact: 'Fakt-Text',
          pattern: 'Muster-Text',
          selfRegulation: 'Regulation-Text',
        })}
        defaultOpen
      />,
    );
    expect(screen.getAllByText('Fakt-Text').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Muster-Text')).toBeInTheDocument();
    expect(screen.getByText('Regulation-Text')).toBeInTheDocument();
  });

  it('renders medicalFinding and relevanceNotes when present', () => {
    render(
      <ObservationCard
        observation={makeObservation({
          medicalFinding: 'Befund X',
          relevanceNotes: 'Relevanz Y',
        })}
        defaultOpen
      />,
    );
    expect(screen.getByRole('heading', { name: 'Medizinischer Befund' })).toBeInTheDocument();
    expect(screen.getByText('Befund X')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Relevanz' })).toBeInTheDocument();
    expect(screen.getByText('Relevanz Y')).toBeInTheDocument();
  });

  it('renders extraSections with their original German keys preserved', () => {
    render(
      <ObservationCard
        observation={makeObservation({
          extraSections: {
            Ursprung: 'Aus Sportunfall 2018.',
            Kausalitaetskette: 'Haltung -> Schulter.',
          },
        })}
        defaultOpen
      />,
    );
    expect(screen.getByRole('heading', { name: 'Ursprung' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kausalitaetskette' })).toBeInTheDocument();
  });

  it('does not render a source badge for user-sourced observations', () => {
    render(<ObservationCard observation={makeObservation({ source: 'user' })} />);
    expect(screen.queryByText('Arzt')).toBeNull();
    expect(screen.queryByText('KI')).toBeNull();
  });

  it('renders the medical source badge when source is medical', () => {
    render(<ObservationCard observation={makeObservation({ source: 'medical' })} />);
    expect(screen.getByText('Arzt')).toBeInTheDocument();
  });

  it('truncates long fact excerpts to 120 characters', () => {
    const long = 'a'.repeat(200);
    render(<ObservationCard observation={makeObservation({ fact: long })} />);
    const text = screen.getByText(/a+\.\.\./);
    expect(text.textContent?.length).toBeLessThanOrEqual(120);
    expect(text.textContent?.endsWith('...')).toBe(true);
  });

  it('strips leading markdown markers from the excerpt', () => {
    render(
      <ObservationCard
        observation={makeObservation({ fact: '## Wichtiger Befund\nDetail darunter.' })}
      />,
    );
    expect(screen.getAllByText('Wichtiger Befund').length).toBeGreaterThanOrEqual(1);
  });
});
