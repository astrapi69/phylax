import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContextGroup } from './ContextGroup';
import { makeOpenPoint } from './test-helpers';

describe('ContextGroup', () => {
  it('renders the context label as a level-2 heading with count', () => {
    render(
      <ContextGroup
        context="Beim naechsten Arztbesuch"
        items={[makeOpenPoint({ id: '1' }), makeOpenPoint({ id: '2' }), makeOpenPoint({ id: '3' })]}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: /Beim naechsten Arztbesuch/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('(3)')).toBeInTheDocument();
  });

  it('renders one list item per open point', () => {
    const { container } = render(
      <ContextGroup
        context="Laufend"
        items={[makeOpenPoint({ id: '1', text: 'A' }), makeOpenPoint({ id: '2', text: 'B' })]}
      />,
    );
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('renders nothing when the items list is empty', () => {
    const { container } = render(<ContextGroup context="Leer" items={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
