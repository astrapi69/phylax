import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatchNavButton } from './MatchNavButton';

describe('MatchNavButton', () => {
  it('renders an accessible button with the supplied aria-label and testId', () => {
    render(
      <MatchNavButton
        direction="down"
        onClick={() => {}}
        ariaLabel="Next match"
        testId="match-next"
      />,
    );
    const btn = screen.getByTestId('match-next');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('aria-label', 'Next match');
  });

  it('fires onClick when activated', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <MatchNavButton
        direction="down"
        onClick={onClick}
        ariaLabel="Next"
        testId="match-next"
      />,
    );
    await user.click(screen.getByTestId('match-next'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('rotates the chevron 180deg for direction=up', () => {
    const { rerender } = render(
      <MatchNavButton direction="down" onClick={vi.fn()} ariaLabel="Next" testId="match" />,
    );
    let svg = screen.getByTestId('match').querySelector('svg');
    expect(svg?.getAttribute('style') ?? '').not.toContain('rotate(180deg)');
    rerender(
      <MatchNavButton direction="up" onClick={vi.fn()} ariaLabel="Prev" testId="match" />,
    );
    svg = screen.getByTestId('match').querySelector('svg');
    expect(svg?.getAttribute('style') ?? '').toContain('rotate(180deg)');
  });

  it('disabled prop sets the native attribute and does not fire onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <MatchNavButton
        direction="down"
        onClick={onClick}
        ariaLabel="Next"
        testId="match-next"
        disabled
      />,
    );
    expect(screen.getByTestId('match-next')).toBeDisabled();
    await user.click(screen.getByTestId('match-next'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
