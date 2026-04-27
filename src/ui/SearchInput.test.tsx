import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchInput } from './SearchInput';

function setup(initial = '') {
  const onChange = vi.fn();
  const utils = render(
    <SearchInput
      value={initial}
      onChange={onChange}
      ariaLabel="Search"
      clearLabel="Clear search"
      placeholder="Type to search"
    />,
  );
  return { onChange, ...utils };
}

describe('SearchInput', () => {
  it('renders the input with the supplied aria-label', () => {
    setup();
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument();
  });

  it('exposes the search landmark', () => {
    setup();
    expect(screen.getByRole('search')).toBeInTheDocument();
  });

  it('shows the placeholder when value is empty', () => {
    setup('');
    expect(screen.getByPlaceholderText('Type to search')).toBeInTheDocument();
  });

  it('hides the clear button when value is empty', () => {
    setup('');
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('shows the clear button when value is non-empty', () => {
    setup('foo');
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });

  it('emits onChange on each keystroke', async () => {
    const user = userEvent.setup();
    const { onChange } = setup('');
    const input = screen.getByRole('searchbox', { name: 'Search' });
    await user.type(input, 'ab');
    expect(onChange).toHaveBeenCalledWith('a');
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('clears value when the clear button is clicked', async () => {
    const user = userEvent.setup();
    const { onChange } = setup('foo');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('clears value when Escape is pressed and input is non-empty', async () => {
    const user = userEvent.setup();
    const { onChange } = setup('foo');
    const input = screen.getByRole('searchbox', { name: 'Search' });
    input.focus();
    await user.keyboard('{Escape}');
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('does not emit onChange on Escape when input is already empty', async () => {
    const user = userEvent.setup();
    const { onChange } = setup('');
    const input = screen.getByRole('searchbox', { name: 'Search' });
    input.focus();
    await user.keyboard('{Escape}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clear button has minimum 44x44 touch target', () => {
    setup('foo');
    const button = screen.getByRole('button', { name: 'Clear search' });
    expect(button.className).toMatch(/min-h-\[44px\]/);
    expect(button.className).toMatch(/min-w-\[44px\]/);
  });
});
