import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordVisibilityToggle } from './PasswordVisibilityToggle';

const LABELS = {
  labelShow: 'Show',
  labelHide: 'Hide',
};

describe('PasswordVisibilityToggle', () => {
  it('renders with the show-label when visible=false', () => {
    render(<PasswordVisibilityToggle visible={false} onToggle={() => {}} {...LABELS} />);
    const button = screen.getByTestId('password-visibility-toggle');
    expect(button).toHaveAccessibleName('Show');
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders with the hide-label when visible=true', () => {
    render(<PasswordVisibilityToggle visible={true} onToggle={() => {}} {...LABELS} />);
    const button = screen.getByTestId('password-visibility-toggle');
    expect(button).toHaveAccessibleName('Hide');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onToggle when clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<PasswordVisibilityToggle visible={false} onToggle={onToggle} {...LABELS} />);
    await user.click(screen.getByTestId('password-visibility-toggle'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('mouse-down preventDefault keeps focus on the password input', () => {
    // Mount toggle alongside an input; verify mouse-down on toggle does
    // not steal focus from the input. Uses fireEvent so we can inspect
    // defaultPrevented on the synthetic event.
    render(
      <div>
        <input data-testid="pw-input" />
        <PasswordVisibilityToggle visible={false} onToggle={() => {}} {...LABELS} />
      </div>,
    );
    const input = screen.getByTestId('pw-input') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    const button = screen.getByTestId('password-visibility-toggle');
    const mouseDown = fireEvent.mouseDown(button);
    expect(mouseDown).toBe(false); // event was preventDefaulted
    // Browsers don't fire focus-shift in jsdom from mouseDown alone, but
    // the assertion above proves the preventDefault hook is wired -
    // which is what the focus-management contract requires.
  });

  it('keyboard activation (Enter) still triggers onToggle', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<PasswordVisibilityToggle visible={false} onToggle={onToggle} {...LABELS} />);
    const button = screen.getByTestId('password-visibility-toggle');
    button.focus();
    await user.keyboard('{Enter}');
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('disabled prop disables the button', () => {
    render(<PasswordVisibilityToggle visible={false} onToggle={() => {}} disabled {...LABELS} />);
    expect(screen.getByTestId('password-visibility-toggle')).toBeDisabled();
  });

  it('clicking disabled button does not call onToggle', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<PasswordVisibilityToggle visible={false} onToggle={onToggle} disabled {...LABELS} />);
    await user.click(screen.getByTestId('password-visibility-toggle'));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('satisfies 44x44 touch target (WCAG 2.5.5)', () => {
    render(<PasswordVisibilityToggle visible={false} onToggle={() => {}} {...LABELS} />);
    const button = screen.getByTestId('password-visibility-toggle');
    expect(button.className).toMatch(/min-h-\[44px\]/);
    expect(button.className).toMatch(/min-w-\[44px\]/);
  });

  it('renders eye icon without strike-through line when hidden', () => {
    render(<PasswordVisibilityToggle visible={false} onToggle={() => {}} {...LABELS} />);
    const svg = screen.getByTestId('password-visibility-toggle').querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.querySelector('line')).toBeNull();
  });

  it('renders eye icon with strike-through line when visible', () => {
    render(<PasswordVisibilityToggle visible={true} onToggle={() => {}} {...LABELS} />);
    const svg = screen.getByTestId('password-visibility-toggle').querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.querySelector('line')).not.toBeNull();
  });

  it('button type is "button" (not submit) so it does not submit forms', () => {
    render(<PasswordVisibilityToggle visible={false} onToggle={() => {}} {...LABELS} />);
    expect(screen.getByTestId('password-visibility-toggle')).toHaveAttribute('type', 'button');
  });
});
