import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';
import { __resetForTest } from './useBodyScrollLock';

beforeEach(() => {
  __resetForTest();
});

afterEach(() => {
  // Restore body overflow even if a test left a Modal mounted, so
  // sibling test files that read document.body.style aren't poisoned.
  __resetForTest();
});

function Harness({
  open = true,
  onClose = vi.fn(),
  ...rest
}: Partial<React.ComponentProps<typeof Modal>>) {
  return (
    <Modal open={open} onClose={onClose} titleId="t" testId="modal-x" {...rest}>
      <h2 id="t">Title</h2>
      <button>Inside</button>
    </Modal>
  );
}

describe('Modal', () => {
  it('renders nothing when open=false (no portal mount)', () => {
    render(<Harness open={false} />);
    expect(screen.queryByTestId('modal-x')).toBeNull();
  });

  it('renders with role=dialog by default and aria-modal=true', () => {
    render(<Harness />);
    const dialog = screen.getByTestId('modal-x');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('t');
  });

  it('uses role=alertdialog when explicitly requested', () => {
    render(<Harness role="alertdialog" />);
    expect(screen.getByTestId('modal-x').getAttribute('role')).toBe('alertdialog');
  });

  it('Escape closes by default', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape suppressed when closeOnEscape=false', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} closeOnEscape={false} />);
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('backdrop click does NOT close by default (Phylax convention)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByTestId('modal-x-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('backdrop click closes when closeOnBackdropClick=true', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} closeOnBackdropClick />);
    await user.click(screen.getByTestId('modal-x-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('clicks inside the dialog do NOT trigger backdrop close even when enabled', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} closeOnBackdropClick />);
    await user.click(screen.getByText('Inside'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('focuses first focusable on mount when no initialFocusRef', () => {
    render(<Harness />);
    expect(document.activeElement).toBe(screen.getByText('Inside'));
  });

  it('focuses initialFocusRef target when supplied', () => {
    const TargetHarness = () => {
      const ref = { current: null as HTMLButtonElement | null };
      return (
        <Modal open onClose={vi.fn()} titleId="t2" testId="m2" initialFocusRef={ref}>
          <h2 id="t2">T</h2>
          <button
            ref={(el) => {
              ref.current = el;
            }}
          >
            Target
          </button>
          <button>Other</button>
        </Modal>
      );
    };
    render(<TargetHarness />);
    expect(document.activeElement).toBe(screen.getByText('Target'));
  });

  it('locks body scroll while open + restores on close', () => {
    document.body.style.overflow = 'scroll';
    const { rerender } = render(<Harness open />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Harness open={false} />);
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('honors zIndex prop for backdrop layering', () => {
    render(<Harness zIndex={70} />);
    const backdrop = screen.getByTestId('modal-x-backdrop');
    expect(backdrop.style.zIndex).toBe('70');
  });

  it('renders into document.body via portal by default', () => {
    render(<Harness />);
    const dialog = screen.getByTestId('modal-x');
    expect(dialog.closest('body')).toBe(document.body);
  });

  it('honors portalTarget override', () => {
    const target = document.createElement('div');
    target.id = 'custom-portal';
    document.body.appendChild(target);
    render(<Harness portalTarget={target} />);
    const dialog = screen.getByTestId('modal-x');
    expect(target.contains(dialog)).toBe(true);
    target.remove();
  });
});
