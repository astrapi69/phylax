import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SupplementCategoryGroup } from './SupplementCategoryGroup';
import type { UseSupplementFormResult } from './useSupplementForm';
import { makeSupplement } from './test-helpers';

function makeFormStub(overrides: Partial<UseSupplementFormResult> = {}): UseSupplementFormResult {
  return {
    state: { kind: 'closed' },
    openCreate: vi.fn(),
    openEdit: vi.fn(),
    openDelete: vi.fn(),
    setField: vi.fn(),
    submit: vi.fn(async () => {}),
    confirmDelete: vi.fn(async () => {}),
    close: vi.fn(),
    ...overrides,
  };
}

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

  it('threads form prop into each card so per-card actions render', () => {
    render(
      <SupplementCategoryGroup
        category="daily"
        label="Täglich"
        supplements={[makeSupplement({ id: 's1' }), makeSupplement({ id: 's2' })]}
        form={makeFormStub()}
      />,
    );
    expect(screen.getByTestId('supplement-edit-btn-s1')).toBeInTheDocument();
    expect(screen.getByTestId('supplement-edit-btn-s2')).toBeInTheDocument();
  });

  it('omits per-card actions when no form prop is supplied', () => {
    render(
      <SupplementCategoryGroup
        category="daily"
        label="Täglich"
        supplements={[makeSupplement({ id: 's1' })]}
      />,
    );
    expect(screen.queryByTestId('supplement-actions')).toBeNull();
  });
});
