import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyStatePanel } from './EmptyStatePanel';

describe('EmptyStatePanel', () => {
  it('renders title as an h2 heading', () => {
    render(<EmptyStatePanel title="No items yet" body="Body text" />);
    const heading = screen.getByRole('heading', { level: 2, name: 'No items yet' });
    expect(heading).toBeInTheDocument();
  });

  it('renders the supplied body text', () => {
    render(<EmptyStatePanel title="t" body="Some body content" />);
    expect(screen.getByText('Some body content')).toBeInTheDocument();
  });

  it('renders the supplied CTA when present', () => {
    render(<EmptyStatePanel title="t" body="b" cta={<a href="/x">Do thing</a>} />);
    expect(screen.getByRole('link', { name: 'Do thing' })).toBeInTheDocument();
  });

  it('omits the CTA when not supplied', () => {
    const { container } = render(<EmptyStatePanel title="t" body="b" />);
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('renders a default empty-box icon when none supplied', () => {
    const { container } = render(<EmptyStatePanel title="t" body="b" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders the supplied icon when provided', () => {
    render(
      <EmptyStatePanel
        title="t"
        body="b"
        icon={<span data-testid="custom-icon">★</span>}
      />,
    );
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('exposes a section landmark with the supplied test id', () => {
    render(<EmptyStatePanel title="t" body="b" testId="my-empty" />);
    expect(screen.getByTestId('my-empty')).toBeInTheDocument();
  });
});
