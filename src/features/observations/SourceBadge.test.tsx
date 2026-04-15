import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SourceBadge } from './SourceBadge';

describe('SourceBadge', () => {
  it('renders "Arzt" label for medical source', () => {
    render(<SourceBadge source="medical" />);
    expect(screen.getByText('Arzt')).toBeInTheDocument();
  });

  it('renders "KI" label for ai source', () => {
    render(<SourceBadge source="ai" />);
    expect(screen.getByText('KI')).toBeInTheDocument();
  });

  it('renders nothing for user source', () => {
    const { container } = render(<SourceBadge source="user" />);
    expect(container.firstChild).toBeNull();
  });
});
