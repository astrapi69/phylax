import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArrayFieldEditor } from './ArrayFieldEditor';

const PROPS = {
  label: 'Test',
  placeholder: 'enter',
  addLabel: 'Add row',
  removeAriaLabel: (n: number) => `Remove row ${n}`,
  testIdPrefix: 'arr',
};

describe('ArrayFieldEditor', () => {
  it('renders one input per value', () => {
    render(<ArrayFieldEditor values={['a', 'b']} onChange={vi.fn()} {...PROPS} />);
    expect(screen.getByTestId('arr-input-0')).toHaveValue('a');
    expect(screen.getByTestId('arr-input-1')).toHaveValue('b');
  });

  it('renders add button always', () => {
    render(<ArrayFieldEditor values={[]} onChange={vi.fn()} {...PROPS} />);
    expect(screen.getByTestId('arr-add')).toHaveTextContent('Add row');
  });

  it('clicking add appends an empty row', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ArrayFieldEditor values={['a']} onChange={onChange} {...PROPS} />);
    await user.click(screen.getByTestId('arr-add'));
    expect(onChange).toHaveBeenCalledWith(['a', '']);
  });

  it('typing in a row calls onChange with the updated array', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ArrayFieldEditor values={['x']} onChange={onChange} {...PROPS} />);
    await user.type(screen.getByTestId('arr-input-0'), 'y');
    // userEvent.type fires onChange per keystroke; assert the final call
    // contains the full updated array.
    expect(onChange).toHaveBeenLastCalledWith(['xy']);
  });

  it('clicking remove drops the row from the array', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ArrayFieldEditor values={['a', 'b', 'c']} onChange={onChange} {...PROPS} />);
    await user.click(screen.getByTestId('arr-remove-1'));
    expect(onChange).toHaveBeenCalledWith(['a', 'c']);
  });

  it('Enter inside a row input does NOT submit the parent form', () => {
    const onChange = vi.fn();
    const onFormSubmit = vi.fn((e: Event) => {
      e.preventDefault();
    });
    render(
      <form onSubmit={(e) => onFormSubmit(e.nativeEvent)}>
        <ArrayFieldEditor values={['a']} onChange={onChange} {...PROPS} />
        <button type="submit">submit</button>
      </form>,
    );
    const input = screen.getByTestId('arr-input-0');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onFormSubmit).not.toHaveBeenCalled();
  });

  it('disabled prop disables every interactive element', () => {
    render(<ArrayFieldEditor values={['a']} onChange={vi.fn()} disabled {...PROPS} />);
    expect(screen.getByTestId('arr-input-0')).toBeDisabled();
    expect(screen.getByTestId('arr-remove-0')).toBeDisabled();
    expect(screen.getByTestId('arr-add')).toBeDisabled();
  });

  it('remove buttons satisfy 44x44 touch target', () => {
    render(<ArrayFieldEditor values={['a']} onChange={vi.fn()} {...PROPS} />);
    const remove = screen.getByTestId('arr-remove-0');
    expect(remove.className).toMatch(/min-h-\[44px\]/);
    expect(remove.className).toMatch(/min-w-\[44px\]/);
  });

  it('add button satisfies 44px touch height', () => {
    render(<ArrayFieldEditor values={[]} onChange={vi.fn()} {...PROPS} />);
    expect(screen.getByTestId('arr-add').className).toMatch(/min-h-\[44px\]/);
  });

  it('removeAriaLabel callback receives 1-based row number', () => {
    const removeAriaLabel = vi.fn((n: number) => `R${n}`);
    render(
      <ArrayFieldEditor
        values={['a', 'b']}
        onChange={vi.fn()}
        {...PROPS}
        removeAriaLabel={removeAriaLabel}
      />,
    );
    expect(screen.getByTestId('arr-remove-0')).toHaveAttribute('aria-label', 'R1');
    expect(screen.getByTestId('arr-remove-1')).toHaveAttribute('aria-label', 'R2');
  });
});
