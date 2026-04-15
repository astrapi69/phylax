import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeGroup } from './ThemeGroup';
import { makeObservation } from './test-helpers';

describe('ThemeGroup', () => {
  it('renders the theme name and count', () => {
    render(
      <ThemeGroup
        theme="Schulter"
        observations={[makeObservation({ id: '1' }), makeObservation({ id: '2' })]}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: /Schulter/ })).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('renders one card per observation', () => {
    const { container } = render(
      <ThemeGroup
        theme="Schulter"
        observations={[
          makeObservation({ id: '1' }),
          makeObservation({ id: '2' }),
          makeObservation({ id: '3' }),
        ]}
      />,
    );
    expect(container.querySelectorAll('details').length).toBe(3);
  });

  it('auto-expands the card in a single-observation group', () => {
    const { container } = render(
      <ThemeGroup theme="Knie" observations={[makeObservation({ id: '1' })]} />,
    );
    expect(container.querySelector('details')?.open).toBe(true);
  });

  it('keeps cards collapsed by default in a multi-observation group', () => {
    const { container } = render(
      <ThemeGroup
        theme="Knie"
        observations={[makeObservation({ id: '1' }), makeObservation({ id: '2' })]}
      />,
    );
    const details = container.querySelectorAll('details');
    expect(details[0]?.open).toBe(false);
    expect(details[1]?.open).toBe(false);
  });
});
