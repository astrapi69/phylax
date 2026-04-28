import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangeFilter } from './DateRangeFilter';

function setup(props: Partial<React.ComponentProps<typeof DateRangeFilter>> = {}) {
  const onFromChange = vi.fn();
  const onToChange = vi.fn();
  const utils = render(
    <DateRangeFilter
      from=""
      to=""
      onFromChange={onFromChange}
      onToChange={onToChange}
      fromLabel="Von"
      toLabel="Bis"
      groupAriaLabel="Zeitraum filtern"
      {...props}
    />,
  );
  return { onFromChange, onToChange, ...utils };
}

describe('DateRangeFilter', () => {
  it('exposes a labeled fieldset for the group', () => {
    setup();
    const group = screen.getByRole('group', { name: 'Zeitraum filtern' });
    expect(group).toBeInTheDocument();
  });

  it('renders both date inputs with their visible labels', () => {
    setup();
    expect(screen.getByText('Von')).toBeInTheDocument();
    expect(screen.getByText('Bis')).toBeInTheDocument();
    expect(screen.getByTestId('date-range-filter-from')).toBeInTheDocument();
    expect(screen.getByTestId('date-range-filter-to')).toBeInTheDocument();
  });

  it('reflects the controlled `from` value in the input', () => {
    setup({ from: '2024-06-01' });
    const fromInput = screen.getByTestId('date-range-filter-from') as HTMLInputElement;
    expect(fromInput.value).toBe('2024-06-01');
  });

  it('reflects the controlled `to` value in the input', () => {
    setup({ to: '2024-06-30' });
    const toInput = screen.getByTestId('date-range-filter-to') as HTMLInputElement;
    expect(toInput.value).toBe('2024-06-30');
  });

  it('emits onFromChange when the from input changes', async () => {
    const user = userEvent.setup();
    const { onFromChange } = setup();
    const fromInput = screen.getByTestId('date-range-filter-from');
    await user.type(fromInput, '2024-06-01');
    expect(onFromChange).toHaveBeenCalledWith('2024-06-01');
  });

  it('emits onToChange when the to input changes', async () => {
    const user = userEvent.setup();
    const { onToChange } = setup();
    const toInput = screen.getByTestId('date-range-filter-to');
    await user.type(toInput, '2024-06-30');
    expect(onToChange).toHaveBeenCalledWith('2024-06-30');
  });

  it('emits an empty string when the user clears the input', async () => {
    const user = userEvent.setup();
    const { onFromChange } = setup({ from: '2024-06-01' });
    const fromInput = screen.getByTestId('date-range-filter-from');
    await user.clear(fromInput);
    expect(onFromChange).toHaveBeenCalledWith('');
  });
});
