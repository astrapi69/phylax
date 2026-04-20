import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WarningCallout } from './WarningCallout';

describe('WarningCallout', () => {
  it('renders children inside a warning region by default', () => {
    render(<WarningCallout>content</WarningCallout>);
    const region = screen.getByRole('alert');
    expect(region).toHaveTextContent('content');
  });

  it('uses role="note" for severity="info"', () => {
    render(<WarningCallout severity="info">info text</WarningCallout>);
    expect(screen.getByRole('note')).toHaveTextContent('info text');
  });

  it('uses role="alert" for severity="danger"', () => {
    render(<WarningCallout severity="danger">danger text</WarningCallout>);
    expect(screen.getByRole('alert')).toHaveTextContent('danger text');
  });

  it('renders the optional title when provided', () => {
    render(
      <WarningCallout title="Achtung">
        <p>body text</p>
      </WarningCallout>,
    );
    expect(screen.getByText('Achtung')).toBeInTheDocument();
    expect(screen.getByText('body text')).toBeInTheDocument();
  });
});
