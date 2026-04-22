import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SupplementCategoryGroup } from './SupplementCategoryGroup';
import { makeSupplement } from './test-helpers';

describe('SupplementCategoryGroup', () => {
  it('renders the category label as a level-2 heading', () => {
    render(
      <SupplementCategoryGroup
        category="daily"
        label="Täglich"
        supplements={[makeSupplement({ id: '1' })]}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: /Täglich/ })).toBeInTheDocument();
  });

  it('renders the count in the heading', () => {
    render(
      <SupplementCategoryGroup
        category="daily"
        label="Täglich"
        supplements={[
          makeSupplement({ id: '1' }),
          makeSupplement({ id: '2' }),
          makeSupplement({ id: '3' }),
        ]}
      />,
    );
    expect(screen.getByText('(3)')).toBeInTheDocument();
  });

  it('renders one list item per supplement', () => {
    const { container } = render(
      <SupplementCategoryGroup
        category="daily"
        label="Täglich"
        supplements={[
          makeSupplement({ id: '1', name: 'A' }),
          makeSupplement({ id: '2', name: 'B' }),
        ]}
      />,
    );
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(2);
  });

  it('renders nothing when the supplements list is empty', () => {
    const { container } = render(
      <SupplementCategoryGroup category="paused" label="Pausiert" supplements={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
