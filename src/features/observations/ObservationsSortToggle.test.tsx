import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ObservationsSortToggle } from './ObservationsSortToggle';

describe('ObservationsSortToggle', () => {
  it('renders both options with German labels', () => {
    render(<ObservationsSortToggle mode="recent" onChange={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: 'Sortierung' }) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['recent', 'alphabetical']);
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toEqual(['Kuerzlich zuerst', 'Alphabetisch']);
  });

  it('shows the current mode as the selected option', () => {
    render(<ObservationsSortToggle mode="alphabetical" onChange={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: 'Sortierung' }) as HTMLSelectElement;
    expect(select.value).toBe('alphabetical');
  });

  it('calls onChange with the new mode when the user picks another option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ObservationsSortToggle mode="recent" onChange={onChange} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sortierung' }), 'alphabetical');
    expect(onChange).toHaveBeenCalledWith('alphabetical');
  });

  it('exposes an accessible aria-label on the select', () => {
    render(<ObservationsSortToggle mode="recent" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Sortierung' })).toBeInTheDocument();
  });
});
