import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ListSkeleton, Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders an aria-hidden block', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('data-testid')).toBe('skeleton');
  });

  it('applies a pulse animation class', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/animate-pulse/);
  });

  it('honours the height prop via inline style', () => {
    const { container } = render(<Skeleton height="40px" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('40px');
  });

  it('forwards extra className', () => {
    const { container } = render(<Skeleton className="custom-class" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/custom-class/);
  });
});

describe('ListSkeleton', () => {
  it('exposes a status landmark with the supplied aria-label', () => {
    render(<ListSkeleton count={3} variant="card" ariaLabel="Loading observations" />);
    const status = screen.getByRole('status', { name: 'Loading observations' });
    expect(status).toBeInTheDocument();
  });

  it('renders the requested number of card placeholders', () => {
    render(<ListSkeleton count={5} variant="card" ariaLabel="x" />);
    const cards = screen.getAllByTestId('list-skeleton-card');
    expect(cards).toHaveLength(5);
  });

  it('renders the requested number of row placeholders', () => {
    render(<ListSkeleton count={4} variant="row" ariaLabel="x" />);
    const rows = screen.getAllByTestId('list-skeleton-row');
    expect(rows).toHaveLength(4);
  });

  it('renders zero items when count is 0', () => {
    render(<ListSkeleton count={0} variant="card" ariaLabel="x" />);
    expect(screen.queryAllByTestId('list-skeleton-card')).toHaveLength(0);
  });
});
