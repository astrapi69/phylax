import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StreamingIndicator } from './StreamingIndicator';

describe('StreamingIndicator', () => {
  it('renders as a status region with a German aria-label', () => {
    render(<StreamingIndicator />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-label', 'KI-Assistent schreibt');
  });

  it('is addressable via test id for parent composition', () => {
    render(<StreamingIndicator />);
    expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument();
  });
});
