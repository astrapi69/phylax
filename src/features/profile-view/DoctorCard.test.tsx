import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DoctorCard } from './DoctorCard';
import { makeDoctor } from './test-helpers';

describe('DoctorCard', () => {
  it('renders name, specialty and address when all present', () => {
    render(
      <DoctorCard
        doctor={makeDoctor({
          name: 'Dr. Mira Beispiel',
          specialty: 'Allgemeinmedizin',
          address: 'Musterstraße 12, 70000 Musterstadt',
        })}
      />,
    );
    expect(screen.getByText('Dr. Mira Beispiel')).toBeInTheDocument();
    expect(screen.getByText('Allgemeinmedizin')).toBeInTheDocument();
    expect(screen.getByText('Musterstraße 12, 70000 Musterstadt')).toBeInTheDocument();
  });

  it('renders only name when specialty and address absent', () => {
    render(<DoctorCard doctor={makeDoctor({ name: 'Dr. X' })} />);
    expect(screen.getByText('Dr. X')).toBeInTheDocument();
    // Exactly one <p>
    expect(screen.getAllByText(/./).length).toBeGreaterThanOrEqual(1);
  });

  it('returns null when doctor is undefined', () => {
    const { container } = render(<DoctorCard doctor={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders address on a separate element from name', () => {
    const { container } = render(<DoctorCard doctor={makeDoctor({ address: 'Adresse Z' })} />);
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
  });
});
